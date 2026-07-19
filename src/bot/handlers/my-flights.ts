import type { Bot } from 'grammy';
import type { BotContext } from '../context.js';
import { getUserSubscriptions } from '../../services/subscription.js';
import { getMyFlightsKeyboard } from '../keyboards.js';

export function registerMyFlightsHandler(bot: Bot<BotContext>) {
  bot.command('myflights', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const subscriptions = await getUserSubscriptions(BigInt(telegramId));

    if (subscriptions.length === 0) {
      await ctx.reply(
        '📋 У вас нет активных подписок.\n\n' + 'Используйте /subscribe чтобы подписаться на рейс.',
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
      return (
        `${i + 1}. ✈️ ${f.flightNumber}\n` +
        `   📍 ${f.origin} → ${f.destination}\n` +
        `   📅 ${dateStr}\n` +
        `   💰 ${priceStr}`
      );
    });

    const text = `📋 Ваши подписки (${subscriptions.length}):\n\n${lines.join('\n\n')}`;

    await ctx.reply(text, {
      reply_markup: getMyFlightsKeyboard(
        subscriptions.map((s) => ({ id: s.id, flight: { flightNumber: s.flight.flightNumber } })),
      ),
    });
  });
}
