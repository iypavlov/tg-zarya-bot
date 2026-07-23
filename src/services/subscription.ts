import { prisma } from '../db/client.js';
import type { FlightPriceResult } from '../types/index.js';

interface FlightData {
  id: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departureDate: Date;
  airline: string;
}

interface SubscriptionResult {
  flight: FlightData;
  price: FlightPriceResult;
  previousPrice?: { amount: number; currency: string };
  subscription: { id: string; isActive: boolean };
  isNew: boolean;
}

export class SubscriptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SubscriptionError';
  }
}

export async function createSubscriptionFromResult(
  telegramId: bigint,
  flightData: FlightPriceResult,
): Promise<SubscriptionResult> {
  const depDate = new Date(flightData.departureDate);

  const existingFlight = await prisma.flight.findFirst({
    where: {
      flightNumber: flightData.flightNumber,
      origin: flightData.origin,
      destination: flightData.destination,
      departureDate: depDate,
    },
  });

  let flight = existingFlight;

  if (!flight) {
    flight = await prisma.flight.create({
      data: {
        flightNumber: flightData.flightNumber,
        origin: flightData.origin,
        destination: flightData.destination,
        departureDate: depDate,
        airline: flightData.airline,
      },
    });
  }

  let previousPrice: { amount: number; currency: string } | null = null;
  if (existingFlight) {
    const lastPrice = await prisma.price.findFirst({
      where: { flightId: flight.id },
      orderBy: { checkedAt: 'desc' },
    });
    if (lastPrice) {
      previousPrice = { amount: Number(lastPrice.amount), currency: lastPrice.currency };
    }
  }

  await prisma.price.create({
    data: {
      flightId: flight.id,
      amount: flightData.amount,
      currency: flightData.currency,
      source: 'travelpayouts',
    },
  });

  const user = await prisma.user.findUnique({ where: { telegramId } });

  if (!user) {
    throw new SubscriptionError('Пользователь не найден. Используйте /start для регистрации.');
  }

  const existingSub = await prisma.subscription.findUnique({
    where: { userId_flightId: { userId: user.id, flightId: flight.id } },
  });

  let subscription;
  if (existingSub) {
    subscription = await prisma.subscription.update({
      where: { id: existingSub.id },
      data: { isActive: true },
    });
  } else {
    subscription = await prisma.subscription.create({
      data: { userId: user.id, flightId: flight.id },
    });
  }

  return {
    flight: {
      id: flight.id,
      flightNumber: flight.flightNumber,
      origin: flight.origin,
      destination: flight.destination,
      departureDate: flight.departureDate,
      airline: flight.airline,
    },
    price: flightData,
    previousPrice: previousPrice ?? undefined,
    subscription: { id: subscription.id, isActive: subscription.isActive },
    isNew: !existingFlight,
  };
}

export async function getUserSubscriptions(telegramId: bigint) {
  const user = await prisma.user.findUnique({
    where: { telegramId },
    include: {
      subscriptions: {
        where: { isActive: true },
        include: {
          flight: {
            include: {
              prices: { orderBy: { checkedAt: 'desc' }, take: 1 },
            },
          },
        },
      },
    },
  });

  return user?.subscriptions ?? [];
}

export async function deactivateSubscription(subscriptionId: string, userId: string) {
  const sub = await prisma.subscription.findFirst({
    where: { id: subscriptionId, userId, isActive: true },
  });

  if (!sub) {
    throw new SubscriptionError('Подписка не найдена или уже отключена.');
  }

  return prisma.subscription.update({
    where: { id: subscriptionId },
    data: { isActive: false },
  });
}

function parseDate(str: string): string | null {
  const dmy = str.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (dmy) {
    const [, day, month, year] = dmy;
    return `${year}-${month}-${day}`;
  }

  const ymd = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) {
    return str;
  }

  return null;
}

const IATA_RE = /^[A-Z]{3}$/;
const FLIGHT_NUM_RE = /^([A-Z]{2})\s?(\d+)$/i;

export function parseFlightInput(
  text: string,
): { flightNumber?: string; origin: string; destination: string; departureDate: string } | null {
  const parts = text.trim().split(/\s+/);

  if (parts.length === 3) {
    const [origin, destination, dateStr] = parts;
    const date = parseDate(dateStr);
    if (!date || !IATA_RE.test(origin.toUpperCase()) || !IATA_RE.test(destination.toUpperCase())) {
      return null;
    }
    return {
      origin: origin.toUpperCase(),
      destination: destination.toUpperCase(),
      departureDate: date,
    };
  }

  if (parts.length === 4) {
    const [flightRaw, origin, destination, dateStr] = parts;
    const m = flightRaw.toUpperCase().match(FLIGHT_NUM_RE);
    if (!m) return null;
    const flightNumber = `${m[1]}${m[2]}`;
    const date = parseDate(dateStr);
    if (!date || !IATA_RE.test(origin.toUpperCase()) || !IATA_RE.test(destination.toUpperCase())) {
      return null;
    }
    return {
      flightNumber,
      origin: origin.toUpperCase(),
      destination: destination.toUpperCase(),
      departureDate: date,
    };
  }

  return null;
}
