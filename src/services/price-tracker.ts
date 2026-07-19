import cron from 'node-cron';
import type { Bot } from 'grammy';
import type { BotContext } from '../bot/context.js';
import { prisma } from '../db/client.js';
import { getFlightPrice } from './travelpayouts.js';
import { notifyPriceChange } from './notification.js';

function formatDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export async function checkPrices(bot: Bot<BotContext>): Promise<{
  checked: number;
  changed: number;
  notified: number;
  errors: number;
}> {
  const subs = await prisma.subscription.findMany({
    where: { isActive: true },
    include: {
      flight: {
        include: {
          prices: { orderBy: { checkedAt: 'desc' }, take: 1 },
        },
      },
    },
  });

  if (subs.length === 0) {
    return { checked: 0, changed: 0, notified: 0, errors: 0 };
  }

  const uniqueFlights = new Map<string, (typeof subs)[0]>();
  for (const sub of subs) {
    const key = sub.flightId;
    if (!uniqueFlights.has(key)) {
      uniqueFlights.set(key, sub);
    }
  }

  let checked = 0;
  let changed = 0;
  let notified = 0;
  let errors = 0;

  for (const [, entry] of uniqueFlights) {
    const flight = entry.flight;
    const depDateStr = formatDate(flight.departureDate);

    try {
      const current = await getFlightPrice(
        flight.flightNumber,
        flight.origin,
        flight.destination,
        depDateStr,
      );

      if (!current) {
        errors++;
        continue;
      }

      checked++;

      const lastPrice = flight.prices[0];
      const lastAmount = lastPrice ? Number(lastPrice.amount) : null;

      if (lastAmount !== null && Math.abs(lastAmount - current.amount) > 0.01) {
        await prisma.price.create({
          data: {
            flightId: flight.id,
            amount: current.amount,
            currency: current.currency,
            source: 'travelpayouts',
          },
        });

        changed++;

        const n = await notifyPriceChange(bot, {
          flightId: flight.id,
          flightNumber: flight.flightNumber,
          origin: flight.origin,
          destination: flight.destination,
          departureDate: flight.departureDate,
          oldAmount: lastAmount,
          newAmount: current.amount,
          currency: current.currency,
        });
        notified += n;
      }
    } catch (err) {
      console.error(
        `Price check error for flight ${flight.flightNumber}:`,
        err instanceof Error ? err.message : err,
      );
      errors++;
    }
  }

  return { checked, changed, notified, errors };
}

export function startPriceTracker(bot: Bot<BotContext>) {
  console.log('PriceTracker: scheduled every hour');

  cron.schedule('0 * * * *', async () => {
    console.log('PriceTracker: running price check...');
    const start = Date.now();
    const result = await checkPrices(bot);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(
      `PriceTracker: done in ${elapsed}s — ` +
        `checked=${result.checked} changed=${result.changed} ` +
        `notified=${result.notified} errors=${result.errors}`,
    );
  });
}
