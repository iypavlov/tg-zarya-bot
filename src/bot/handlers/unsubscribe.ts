import type { Bot } from 'grammy';
import type { BotContext } from '../context.js';
import {
  getUserSubscriptions,
  deactivateSubscription,
  SubscriptionError,
} from '../../services/subscription.js';
import { getMyFlightsKeyboard } from '../keyboards.js';

export function registerUnsubscribeHandler(bot: Bot<BotContext>) {
  bot.command('unsubscribe', async (ctx) => {
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
      const dateStr = f.departureDate.toLocaleDateString('ru-RU');
      return `${i + 1}. ✈️ ${f.flightNumber} — ${f.origin} → ${f.destination} (${dateStr})`;
    });

    const text = `❌ Выберите подписку для отмены:\n\n${lines.join('\n')}`;

    await ctx.reply(text, {
      reply_markup: getMyFlightsKeyboard(
        subscriptions.map((s) => ({ id: s.id, flight: { flightNumber: s.flight.flightNumber } })),
      ),
    });
  });
}

export async function executeUnsubscribe(ctx: BotContext, subId: string) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const user = await ctx.prisma.user.findUnique({ where: { telegramId: BigInt(telegramId) } });
  if (!user) return;

  try {
    await deactivateSubscription(subId, user.id);
    await ctx.editMessageText(
      '✅ Подписка отключена. Вы больше не будете получать уведомления по этому рейсу.',
    );
  } catch (err) {
    if (err instanceof SubscriptionError) {
      await ctx.answerCallbackQuery({ text: err.message });
    } else {
      console.error('Unsubscribe error:', err);
      await ctx.answerCallbackQuery({ text: '❌ Ошибка при отписке.' });
    }
  }
}
