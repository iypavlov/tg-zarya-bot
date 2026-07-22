import type { Bot } from 'grammy';
import type { BotContext } from '../context.js';
import {
  createSubscriptionFromResult,
  deactivateSubscription,
  getUserSubscriptions,
  SubscriptionError,
} from '../../services/subscription.js';
import {
  getFlightInputKeyboard,
  getMainMenuKeyboard,
  getMyFlightsKeyboard,
  getSubscriptionResultKeyboard,
  getUnsubConfirmKeyboard,
  MAIN_MENU_TEXT,
} from '../keyboards.js';
import { safeEditMessageText } from '../helpers.js';

const SEPARATOR = '\n╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌\n';

export function registerCallbackHandler(bot: Bot<BotContext>) {
  bot.callbackQuery('subscribe', async (ctx) => {
    await ctx.answerCallbackQuery();
    ctx.session.step = 'awaiting_flight';
    ctx.session.flightData = {};
    ctx.session.searchResults = undefined;
    await safeEditMessageText(
      ctx,
      '✈️ Введите данные рейса одной строкой:\n\n' +
        '`SU1234 SVO LED 25.12.2024`\n\n' +
        'Формат:\n' +
        '• Номер рейса (опционально): SU1234\n' +
        '• Аэропорт вылета: SVO\n' +
        '• Аэропорт назначения: LED\n' +
        '• Дата: ДД.ММ.ГГГГ или ГГГГ-ММ-ДД',
      { parse_mode: 'Markdown', reply_markup: getFlightInputKeyboard() },
    );
  });

  bot.callbackQuery('myflights', async (ctx) => {
    await ctx.answerCallbackQuery();
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    try {
      const subscriptions = await getUserSubscriptions(BigInt(telegramId));

      if (subscriptions.length === 0) {
        await safeEditMessageText(
          ctx,
          'У вас нет активных подписок.',
          { reply_markup: getMainMenuKeyboard() },
        );
        return;
      }

      const lines = subscriptions.map((sub, i) => {
        const f = sub.flight;
        const lastPrice = f.prices[0];
        const priceStr = lastPrice
          ? `${Number(lastPrice.amount).toLocaleString('ru-RU')} ${lastPrice.currency}`
          : '—';
        const dateStr = f.departureDate.toLocaleDateString('ru-RU', {
          day: 'numeric',
          month: 'short',
        });
        const timeStr = f.departureDate.toLocaleTimeString('ru-RU', {
          hour: '2-digit',
          minute: '2-digit',
        });
        return (
          `✈️ <b>${i + 1}. ${f.flightNumber}</b>\n` +
          `   🛫 ${f.origin} → 🛬 ${f.destination}  ·  🏢 ${f.airline}\n` +
          `   📅 ${dateStr}  ·  🕐 ${timeStr}\n` +
          `   💰 <b>${priceStr}</b>`
        );
      });

      const text =
        `📋 <b>Ваши подписки (${subscriptions.length})</b>\n${lines.join(SEPARATOR)}`;

      await safeEditMessageText(ctx, text, {
        parse_mode: 'HTML',
        reply_markup: getMyFlightsKeyboard(
          subscriptions.map((s) => ({
            id: s.id,
            flight: {
              flightNumber: s.flight.flightNumber,
              origin: s.flight.origin,
              destination: s.flight.destination,
            },
          })),
        ),
      });
    } catch (error) {
      console.error('Error in myflights callback:', error);
      await safeEditMessageText(ctx, 'Произошла ошибка. Попробуйте позже.', {
        reply_markup: getMainMenuKeyboard(),
      });
    }
  });

  bot.callbackQuery('help', async (ctx) => {
    await ctx.answerCallbackQuery();
    await safeEditMessageText(
      ctx,
      'ℹ️ Zarya Bot — отслеживает цены на авиабилеты и уведомляет об изменениях.\n\n' +
        '/start — главное меню\n\n' +
        '💻 Github: https://github.com/iypavlov/tg-zarya-bot',
      { reply_markup: getMainMenuKeyboard() },
    );
  });

  bot.callbackQuery(/^select_ticket:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();

    const index = parseInt(ctx.match[1], 10);
    const cached = ctx.session.searchResults;

    if (!cached || index >= cached.length) {
      await safeEditMessageText(ctx, '⏳ Результаты поиска устарели. Попробуйте снова.', {
        reply_markup: getMainMenuKeyboard(),
      });
      return;
    }

    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const selected = {
      flightNumber: cached[index].flightNumber,
      airline: cached[index].airline,
      origin: cached[index].origin,
      destination: cached[index].destination,
      departureDate: new Date(cached[index].departureDate),
      amount: cached[index].amount,
      currency: cached[index].currency,
      transfers: cached[index].transfers,
    };

    ctx.session.searchResults = undefined;
    ctx.session.flightData = {};

    try {
      const result = await createSubscriptionFromResult(BigInt(telegramId), selected);

      const dateStr = result.flight.departureDate.toLocaleDateString('ru-RU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      const price = `${Number(result.price.amount).toLocaleString('ru-RU')} ${result.price.currency}`;

      const transferTag = selected.transfers === 0 ? 'прямой' : `${selected.transfers} пер.`;

      await safeEditMessageText(
        ctx,
        `✅ Подписка оформлена!\n\n` +
          `${result.flight.flightNumber}\n` +
          `${result.flight.origin}  ${result.flight.destination}\n` +
          `${dateStr}\n` +
          `Цена: ${price}\n` +
          `Пересадки: ${transferTag}`,
        { reply_markup: getSubscriptionResultKeyboard() },
      );
    } catch (err) {
      if (err instanceof SubscriptionError) {
        await safeEditMessageText(ctx, err.message, { reply_markup: getMainMenuKeyboard() });
      } else {
        console.error('Select ticket error:', err);
        await safeEditMessageText(ctx, '❌ Произошла ошибка. Попробуйте позже.', {
          reply_markup: getMainMenuKeyboard(),
        });
      }
    }
  });

  bot.callbackQuery(/^unsub:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const subId = ctx.match[1];

    const sub = await ctx.prisma.subscription.findUnique({
      where: { id: subId },
      include: { flight: true },
    });

    if (!sub) {
      await ctx.answerCallbackQuery({ text: 'Подписка не найдена.' });
      return;
    }

    const dateStr = sub.flight.departureDate.toLocaleDateString('ru-RU');

    await safeEditMessageText(
      ctx,
      `❌ Отписаться от рейса ${sub.flight.flightNumber}?\n` +
        `📍 ${sub.flight.origin} → ${sub.flight.destination}\n` +
        `📅 ${dateStr}`,
      { reply_markup: getUnsubConfirmKeyboard(subId) },
    );
  });

  bot.callbackQuery(/^confirm_unsub:(.+)$/, async (ctx) => {
    const subId = ctx.match[1];
    const telegramId = ctx.from?.id;
    if (!telegramId) {
      await ctx.answerCallbackQuery({ text: 'Ошибка идентификации.' });
      return;
    }

    const user = await ctx.prisma.user.findUnique({ where: { telegramId: BigInt(telegramId) } });
    if (!user) {
      await ctx.answerCallbackQuery({ text: 'Пользователь не найден.' });
      return;
    }

    try {
      await deactivateSubscription(subId, user.id);
      await safeEditMessageText(ctx, '✅ Подписка отключена. Вы больше не будете получать уведомления по этому рейсу.', {
        reply_markup: getMainMenuKeyboard(),
      });
      await ctx.answerCallbackQuery({ text: 'Подписка отключена' });
    } catch (err) {
      if (err instanceof SubscriptionError) {
        await ctx.answerCallbackQuery({ text: err.message });
      } else {
        console.error('Unsubscribe callback error:', err);
        await ctx.answerCallbackQuery({ text: '❌ Ошибка при отписке.' });
      }
    }
  });

  bot.callbackQuery('cancel_unsub', async (ctx) => {
    await ctx.answerCallbackQuery({ text: '❌ Отменено' });
    await safeEditMessageText(ctx, MAIN_MENU_TEXT, {
      reply_markup: getMainMenuKeyboard(),
    });
  });

  bot.callbackQuery('menu', async (ctx) => {
    await ctx.answerCallbackQuery();
    ctx.session.step = undefined;
    await safeEditMessageText(ctx, MAIN_MENU_TEXT, {
      reply_markup: getMainMenuKeyboard(),
    });
  });
}
