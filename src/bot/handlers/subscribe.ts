import type { Bot } from 'grammy';
import type { BotContext } from '../context.js';
import {
  createSubscription,
  parseFlightInput,
  SubscriptionError,
} from '../../services/subscription.js';
import { getFlightInfoKeyboard } from '../keyboards.js';

export function registerSubscribeHandler(bot: Bot<BotContext>) {
  bot.command('subscribe', async (ctx) => {
    ctx.session.step = 'awaiting_flight';
    ctx.session.flightData = {};

    await ctx.reply(
      '✈️ Введите данные рейса одной строкой:\n\n' +
        '`SU1234 SVO LED 25.12.2024`\n\n' +
        'Формат:\n' +
        '• Номер рейса (опционально): SU1234\n' +
        '• Аэропорт вылета: SVO\n' +
        '• Аэропорт назначения: LED\n' +
        '• Дата: ДД.ММ.ГГГГ или ГГГГ-ММ-ДД\n\n' +
        'Отправьте /cancel чтобы отменить.',
      { parse_mode: 'Markdown' },
    );
  });

  bot.command('cancel', async (ctx) => {
    if (ctx.session.step) {
      ctx.session.step = undefined;
      ctx.session.flightData = {};
      await ctx.reply('❌ Операция отменена.');
    }
  });

  bot.on('message:text', async (ctx) => {
    if (ctx.session.step !== 'awaiting_flight') return;

    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const parsed = parseFlightInput(ctx.message.text);
    if (!parsed) {
      await ctx.reply(
        '❌ Не удалось распознать формат. Попробуйте ещё раз:\n\n' +
          '`SU1234 SVO LED 25.12.2024`\n\n' +
          'Отправьте /cancel чтобы отменить.',
        { parse_mode: 'Markdown' },
      );
      return;
    }

    ctx.session.step = undefined;
    ctx.session.flightData = {};

    const statusMsg = await ctx.reply('🔍 Ищу информацию о рейсе...');

    try {
      const result = await createSubscription(
        BigInt(telegramId),
        parsed.flightNumber,
        parsed.origin,
        parsed.destination,
        parsed.departureDate,
      );

      const depDate = new Date(parsed.departureDate);
      const dateStr = depDate.toLocaleDateString('ru-RU');

      await ctx.api.deleteMessage(ctx.chat!.id, statusMsg.message_id).catch(() => {});

      const oldPriceLine = result.previousPrice
        ? `📊 Было: ${Number(result.previousPrice.amount).toLocaleString('ru-RU')} ${result.previousPrice.currency}\n`
        : '';

      await ctx.reply(
        `✅ Подписка оформлена!\n\n` +
          `✈️ Рейс: ${result.flight.flightNumber}\n` +
          `📍 ${result.flight.origin} → ${result.flight.destination}\n` +
          `📅 ${dateStr}\n` +
          `${oldPriceLine}` +
          `💰 Цена: ${Number(result.price.amount).toLocaleString('ru-RU')} ${result.price.currency}`,
        { reply_markup: getFlightInfoKeyboard(result.flight.id) },
      );
    } catch (err) {
      await ctx.api.deleteMessage(ctx.chat!.id, statusMsg.message_id).catch(() => {});

      if (err instanceof SubscriptionError) {
        await ctx.reply(`❌ ${err.message}`);
      } else {
        console.error('Subscribe error:', err);
        await ctx.reply('❌ Произошла ошибка при оформлении подписки. Попробуйте позже.');
      }
    }
  });
}
