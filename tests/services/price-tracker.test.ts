import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkPrices } from '../../src/services/price-tracker.js';

const mockPrisma = vi.hoisted(() => ({
  subscription: { findMany: vi.fn(), updateMany: vi.fn() },
  price: { create: vi.fn() },
}));

vi.mock('../../src/db/client.js', () => ({ prisma: mockPrisma }));

vi.mock('../../src/services/travelpayouts.js', () => ({
  getFlightPrice: vi.fn(),
}));

const mockBot = {
  api: {
    sendMessage: vi.fn().mockResolvedValue({}),
  },
};

const MOCK_PRICE_1 = { id: 'price-1', amount: 12450, currency: 'RUB', checkedAt: new Date() };
const MOCK_PRICE_2 = { id: 'price-2', amount: 15000, currency: 'RUB', checkedAt: new Date() };

const FLIGHT = {
  id: 'flight-1',
  flightNumber: 'SU1234',
  origin: 'SVO',
  destination: 'LED',
  departureDate: new Date('2025-12-25'),
  airline: 'SU',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('checkPrices', () => {
  it('should return zeros when no active subscriptions', async () => {
    mockPrisma.subscription.findMany.mockResolvedValue([]);

    const result = await checkPrices(mockBot as never);

    expect(result).toEqual({ checked: 0, changed: 0, notified: 0, errors: 0 });
  });

  it('should check price for unique flights', async () => {
    const { getFlightPrice } = await import('../../src/services/travelpayouts.js');

    const sub = {
      id: 'sub-1',
      flightId: 'flight-1',
      isActive: true,
      notifyOnChange: true,
      flight: { ...FLIGHT, prices: [MOCK_PRICE_1] },
    };

    mockPrisma.subscription.findMany.mockResolvedValue([sub]);

    vi.mocked(getFlightPrice).mockResolvedValue({
      flightNumber: 'SU1234',
      airline: 'SU',
      origin: 'SVO',
      destination: 'LED',
      departureDate: new Date('2025-12-25'),
      amount: 12450,
      currency: 'RUB',
      transfers: 0,
    });

    mockPrisma.price.create.mockResolvedValue({});

    const result = await checkPrices(mockBot as never);

    expect(result.checked).toBe(1);
    expect(result.changed).toBe(0);
    expect(result.notified).toBe(0);
    expect(result.errors).toBe(0);
    expect(mockPrisma.price.create).not.toHaveBeenCalled();
  });

  it('should detect price change and notify', async () => {
    const { getFlightPrice } = await import('../../src/services/travelpayouts.js');

    const sub = {
      id: 'sub-1',
      flightId: 'flight-1',
      isActive: true,
      notifyOnChange: true,
      flight: {
        ...FLIGHT,
        prices: [{ id: 'price-1', amount: 10000, currency: 'RUB', checkedAt: new Date() }],
      },
    };

    const mockUsers = [{ id: 'user-1', telegramId: BigInt(123), username: 'user1' }];

    mockPrisma.subscription.findMany.mockResolvedValueOnce([sub]).mockResolvedValueOnce(
      mockUsers.map((u) => ({
        id: 'sub-1',
        flightId: 'flight-1',
        isActive: true,
        notifyOnChange: true,
        user: u,
      })),
    );

    vi.mocked(getFlightPrice).mockResolvedValue({
      flightNumber: 'SU1234',
      airline: 'SU',
      origin: 'SVO',
      destination: 'LED',
      departureDate: new Date('2025-12-25'),
      amount: 15000,
      currency: 'RUB',
      transfers: 0,
    });

    mockPrisma.price.create.mockResolvedValue({});
    mockPrisma.subscription.updateMany.mockResolvedValue({ count: 1 });

    const result = await checkPrices(mockBot as never);

    expect(result.checked).toBe(1);
    expect(result.changed).toBe(1);
    expect(result.notified).toBe(1);
    expect(result.errors).toBe(0);
    expect(mockPrisma.price.create).toHaveBeenCalledOnce();
    expect(mockBot.api.sendMessage).toHaveBeenCalledWith(123, expect.any(String), {
      parse_mode: 'HTML',
    });
    const sentText = mockBot.api.sendMessage.mock.calls[0][1] as string;
    expect(sentText).toContain('Изменение цены');
    expect(sentText).toContain('SU1234');
    expect(sentText).toContain('RUB');
  });

  it('should handle API errors gracefully', async () => {
    const { getFlightPrice } = await import('../../src/services/travelpayouts.js');

    const sub = {
      id: 'sub-1',
      flightId: 'flight-1',
      isActive: true,
      notifyOnChange: true,
      flight: { ...FLIGHT, prices: [MOCK_PRICE_1] },
    };

    mockPrisma.subscription.findMany.mockResolvedValue([sub]);
    vi.mocked(getFlightPrice).mockRejectedValue(new Error('API timeout'));

    const result = await checkPrices(mockBot as never);

    expect(result.checked).toBe(0);
    expect(result.changed).toBe(0);
    expect(result.errors).toBe(1);
  });

  it('should handle null price result from API', async () => {
    const { getFlightPrice } = await import('../../src/services/travelpayouts.js');

    const sub = {
      id: 'sub-1',
      flightId: 'flight-1',
      isActive: true,
      notifyOnChange: true,
      flight: { ...FLIGHT, prices: [MOCK_PRICE_1] },
    };

    mockPrisma.subscription.findMany.mockResolvedValue([sub]);
    vi.mocked(getFlightPrice).mockResolvedValue(null);

    const result = await checkPrices(mockBot as never);

    expect(result.errors).toBe(1);
    expect(result.checked).toBe(0);
  });

  it('should deduplicate multiple subs for same flight', async () => {
    const { getFlightPrice } = await import('../../src/services/travelpayouts.js');

    const sub1 = {
      id: 'sub-1',
      flightId: 'flight-1',
      isActive: true,
      notifyOnChange: true,
      flight: { ...FLIGHT, prices: [MOCK_PRICE_1] },
    };
    const sub2 = {
      id: 'sub-2',
      flightId: 'flight-1',
      isActive: true,
      notifyOnChange: true,
      flight: { ...FLIGHT, prices: [MOCK_PRICE_1] },
    };

    mockPrisma.subscription.findMany.mockResolvedValue([sub1, sub2]);
    vi.mocked(getFlightPrice).mockResolvedValue({
      flightNumber: 'SU1234',
      airline: 'SU',
      origin: 'SVO',
      destination: 'LED',
      departureDate: new Date('2025-12-25'),
      amount: 12450,
      currency: 'RUB',
      transfers: 0,
    });

    const result = await checkPrices(mockBot as never);

    expect(result.checked).toBe(1);
    expect(vi.mocked(getFlightPrice)).toHaveBeenCalledTimes(1);
  });
});
