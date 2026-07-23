import type { Bot } from 'grammy';
import type { BotContext } from '../bot/context.js';
import { prisma } from '../db/client.js';

interface PriceChange {
  flightId: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departureDate: Date;
  oldAmount: number;
  newAmount: number;
  currency: string;
}

export async function notifyPriceChange(
  bot: Bot<BotContext>,
  change: PriceChange,
): Promise<number> {
  const subs = await prisma.subscription.findMany({
    where: { flightId: change.flightId, isActive: true, notifyOnChange: true },
    include: { user: true },
  });

  if (subs.length === 0) return 0;

  const diff = change.newAmount - change.oldAmount;
  const sign = diff > 0 ? '📈' : '📉';
  const diffPercent = ((diff / change.oldAmount) * 100).toFixed(1);
  const dateStr = change.departureDate.toLocaleDateString('ru-RU');
  const arrow = diff > 0 ? '↑' : '↓';

  const message =
    `${sign} <b>Изменение цены!</b>\n\n` +
    `✈️ Рейс: <b>${change.flightNumber}</b>\n` +
    `📍 ${change.origin} → ${change.destination}\n` +
    `📅 ${dateStr}\n\n` +
    `💰 ${change.oldAmount.toLocaleString('ru-RU')} ${change.currency}` +
    ` ${arrow} <b>${change.newAmount.toLocaleString('ru-RU')} ${change.currency}</b>\n` +
    `📊 Изменение: ${diff > 0 ? '+' : ''}${diff.toLocaleString('ru-RU')} ${change.currency} (${diffPercent}%)`;

  let sentCount = 0;
  for (const sub of subs) {
    try {
      await bot.api.sendMessage(Number(sub.user.telegramId), message, {
        parse_mode: 'HTML',
      });
      sentCount++;
    } catch (err) {
      console.error(
        `Failed to send notification to user ${sub.user.telegramId}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  await prisma.subscription.updateMany({
    where: { flightId: change.flightId, isActive: true },
    data: { lastNotifiedAt: new Date() },
  });

  return sentCount;
}
