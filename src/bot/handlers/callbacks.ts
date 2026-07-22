import type { Bot } from 'grammy';
import type { BotContext } from '../context.js';
import {
  getUserSubscriptions,
  deactivateSubscription,
  SubscriptionError,
} from '../../services/subscription.js';
import {
  getMyFlightsKeyboard,
  getMainMenuKeyboard,
  getUnsubConfirmKeyboard,
} from '../keyboards.js';

export function registerCallbackHandler(bot: Bot<BotContext>) {
  // TODO: текст подсказки дублируется с subscribe.ts — вынести в общую функцию
  bot.callbackQuery('subscribe', async (ctx) => {
    await ctx.answerCallbackQuery();
    ctx.session.step = 'awaiting_flight';
    ctx.session.flightData = {};
    await ctx.editMessageText(
      '✈️ Введите данные рейса одной строкой:\n\n' +
        '`SU1234 SVO LED 25.12.2024`\n\n' +
        'Или просто направление:\n' +
        '`SVO LED 25.12.2024`',
      { parse_mode: 'Markdown' },
    );
  });

  // TODO: логика построения списка подписок дублируется с my-flights.ts — вынести в общую функцию
  bot.callbackQuery('myflights', async (ctx) => {
    await ctx.answerCallbackQuery();
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const subscriptions = await getUserSubscriptions(BigInt(telegramId));

    if (subscriptions.length === 0) {
      await ctx.editMessageText(
        '📋 У вас нет активных подписок.\n\nИспользуйте /subscribe чтобы подписаться на рейс.',
      );
      return;
    }

    const lines = subscriptions.map((sub, i) => {
      const f = sub.flight;
      const lastPrice = f.prices[0];
      const priceStr = lastPrice
        ? `${Number(lastPrice.amount).toLocaleString('ru-RU')} ${lastPrice.currency}`
        : '—';
      const dateStr = f.departureDate.toLocaleDateString('ru-RU');
      return `${i + 1}. ✈️ ${f.flightNumber}\n   📍 ${f.origin} → ${f.destination}\n   📅 ${dateStr}\n   💰 ${priceStr}`;
    });

    const text = `📋 Ваши подписки (${subscriptions.length}):\n\n${lines.join('\n\n')}`;

    const keyboard = getMyFlightsKeyboard(
      subscriptions.map((s) => ({
        id: s.id,
        flight: { flightNumber: s.flight.flightNumber },
      })),
    );

    await ctx.editMessageText(text, { reply_markup: keyboard });
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

    await ctx.editMessageText(
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
      await ctx.editMessageText('✅ Подписка отключена.');
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
    await ctx.answerCallbackQuery({ text: 'Отменено' });
    await ctx.deleteMessage();
  });

  bot.callbackQuery(/^unsub_from_flight:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const flightId = ctx.match[1];

    const sub = await ctx.prisma.subscription.findFirst({
      where: {
        flightId,
        user: { telegramId: BigInt(ctx.from.id) },
        isActive: true,
      },
      include: { flight: true },
    });

    if (!sub) {
      await ctx.answerCallbackQuery({ text: 'Подписка не найдена.' });
      return;
    }

    const dateStr = sub.flight.departureDate.toLocaleDateString('ru-RU');

    await ctx.editMessageText(
      `❌ Отписаться от рейса ${sub.flight.flightNumber}?\n` +
        `📍 ${sub.flight.origin} → ${sub.flight.destination}\n` +
        `📅 ${dateStr}`,
      { reply_markup: getUnsubConfirmKeyboard(sub.id) },
    );
  });

  bot.callbackQuery('menu', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      '🏠 Главное меню\n\n' +
        '/subscribe — подписаться на рейс\n' +
        '/myflights — мои подписки\n' +
        '/unsubscribe — отписаться',
      { reply_markup: getMainMenuKeyboard() },
    );
  });
}
