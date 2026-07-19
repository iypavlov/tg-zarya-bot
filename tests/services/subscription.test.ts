import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseFlightInput,
  createSubscription,
  getUserSubscriptions,
  deactivateSubscription,
  SubscriptionError,
} from '../../src/services/subscription.js';

vi.mock('../../src/services/travelpayouts.js', () => ({
  getFlightPrice: vi.fn(),
  searchFlights: vi.fn(),
}));

const mockPrisma = vi.hoisted(() => ({
  flight: { findFirst: vi.fn(), create: vi.fn() },
  price: { create: vi.fn(), findFirst: vi.fn() },
  user: { findUnique: vi.fn() },
  subscription: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
}));

vi.mock('../../src/db/client.js', () => ({ prisma: mockPrisma }));

const MOCK_FLIGHT_RESULT = {
  flightNumber: 'SU1234',
  airline: 'SU',
  origin: 'SVO',
  destination: 'LED',
  departureDate: new Date('2025-12-25T10:00:00+03:00'),
  amount: 12450,
  currency: 'RUB',
  transfers: 0,
};

const MOCK_USER = {
  id: 'user-1',
  telegramId: BigInt(123456789),
  username: 'testuser',
  firstName: 'Test',
};

const MOCK_FLIGHT_DB = {
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

describe('parseFlightInput', () => {
  it('should parse full format with flight number', () => {
    const result = parseFlightInput('SU1234 SVO LED 25.12.2024');
    expect(result).toEqual({
      flightNumber: 'SU1234',
      origin: 'SVO',
      destination: 'LED',
      departureDate: '2024-12-25',
    });
  });

  it('should parse format without flight number', () => {
    const result = parseFlightInput('SVO LED 25.12.2024');
    expect(result).toEqual({
      origin: 'SVO',
      destination: 'LED',
      departureDate: '2024-12-25',
    });
    expect(result).not.toHaveProperty('flightNumber');
  });

  it('should parse YYYY-MM-DD date format', () => {
    const result = parseFlightInput('SU1234 SVO LED 2024-12-25');
    expect(result).toEqual({
      flightNumber: 'SU1234',
      origin: 'SVO',
      destination: 'LED',
      departureDate: '2024-12-25',
    });
  });

  it('should accept lowercase input', () => {
    const result = parseFlightInput('su1234 svo led 25.12.2024');
    expect(result).toEqual({
      flightNumber: 'SU1234',
      origin: 'SVO',
      destination: 'LED',
      departureDate: '2024-12-25',
    });
  });

  it('should trim surrounding whitespace', () => {
    const result = parseFlightInput('  SU1234 SVO LED 25.12.2024  ');
    expect(result).not.toBeNull();
    expect(result!.flightNumber).toBe('SU1234');
  });

  it('should return null for empty string', () => {
    expect(parseFlightInput('')).toBeNull();
  });

  it('should return null for too few parts', () => {
    expect(parseFlightInput('SVO LED')).toBeNull();
  });

  it('should return null for too many parts', () => {
    expect(parseFlightInput('SU 1234 SVO LED 25.12.2024')).toBeNull();
  });

  it('should return null for invalid IATA code', () => {
    expect(parseFlightInput('SU1234 SVXX LED 25.12.2024')).toBeNull();
  });

  it('should return null for invalid date', () => {
    expect(parseFlightInput('SU1234 SVO LED 25-12-2024')).toBeNull();
  });

  it('should return null for invalid flight number format', () => {
    expect(parseFlightInput('INVALID SVO LED 25.12.2024')).toBeNull();
  });

  it('should handle different flight number formats', () => {
    const result = parseFlightInput('DP5678 SVO LED 25.12.2024');
    expect(result).toEqual({
      flightNumber: 'DP5678',
      origin: 'SVO',
      destination: 'LED',
      departureDate: '2024-12-25',
    });
  });
});

describe('createSubscription', () => {
  it('should create subscription with flight number found', async () => {
    const { getFlightPrice } = await import('../../src/services/travelpayouts.js');
    vi.mocked(getFlightPrice).mockResolvedValue(MOCK_FLIGHT_RESULT);

    mockPrisma.flight.findFirst.mockResolvedValue(null);
    mockPrisma.flight.create.mockResolvedValue(MOCK_FLIGHT_DB);
    mockPrisma.price.create.mockResolvedValue({});
    mockPrisma.user.findUnique.mockResolvedValue(MOCK_USER);
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    mockPrisma.subscription.create.mockResolvedValue({
      id: 'sub-1',
      isActive: true,
    });

    const result = await createSubscription(
      BigInt(123456789),
      'SU1234',
      'SVO',
      'LED',
      '2025-12-25',
    );

    expect(result.flight.flightNumber).toBe('SU1234');
    expect(result.subscription.isActive).toBe(true);
    expect(result.isNew).toBe(true);
    expect(mockPrisma.flight.create).toHaveBeenCalledOnce();
    expect(mockPrisma.subscription.create).toHaveBeenCalledOnce();
  });

  it('should throw when flight number not found', async () => {
    const { getFlightPrice } = await import('../../src/services/travelpayouts.js');
    vi.mocked(getFlightPrice).mockResolvedValue(null);

    await expect(
      createSubscription(BigInt(123456789), 'SU9999', 'SVO', 'LED', '2025-12-25'),
    ).rejects.toThrow(SubscriptionError);

    expect(mockPrisma.flight.findFirst).not.toHaveBeenCalled();
  });

  it('should search flights when no flight number given', async () => {
    const { searchFlights } = await import('../../src/services/travelpayouts.js');
    vi.mocked(searchFlights).mockResolvedValue([{ ...MOCK_FLIGHT_RESULT, flightNumber: 'DP5678' }]);

    mockPrisma.flight.findFirst.mockResolvedValue(null);
    mockPrisma.flight.create.mockResolvedValue({
      ...MOCK_FLIGHT_DB,
      flightNumber: 'DP5678',
      id: 'flight-2',
    });
    mockPrisma.price.create.mockResolvedValue({});
    mockPrisma.user.findUnique.mockResolvedValue(MOCK_USER);
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    mockPrisma.subscription.create.mockResolvedValue({ id: 'sub-2', isActive: true });

    const result = await createSubscription(
      BigInt(123456789),
      undefined,
      'SVO',
      'LED',
      '2025-12-25',
    );

    expect(result.flight.flightNumber).toBe('DP5678');
    expect(vi.mocked(searchFlights)).toHaveBeenCalledWith({
      origin: 'SVO',
      destination: 'LED',
      departureDate: '2025-12-25',
    });
  });

  it('should throw when no flights found on route', async () => {
    const { searchFlights } = await import('../../src/services/travelpayouts.js');
    vi.mocked(searchFlights).mockResolvedValue([]);

    await expect(
      createSubscription(BigInt(123456789), undefined, 'SVO', 'LED', '2025-12-25'),
    ).rejects.toThrow(SubscriptionError);
  });

  it('should reuse existing flight', async () => {
    const { getFlightPrice } = await import('../../src/services/travelpayouts.js');
    vi.mocked(getFlightPrice).mockResolvedValue(MOCK_FLIGHT_RESULT);

    mockPrisma.flight.findFirst.mockResolvedValue(MOCK_FLIGHT_DB);
    mockPrisma.price.findFirst.mockResolvedValue(null);
    mockPrisma.price.create.mockResolvedValue({});
    mockPrisma.user.findUnique.mockResolvedValue(MOCK_USER);
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    mockPrisma.subscription.create.mockResolvedValue({ id: 'sub-1', isActive: true });

    const result = await createSubscription(
      BigInt(123456789),
      'SU1234',
      'SVO',
      'LED',
      '2025-12-25',
    );

    expect(result.isNew).toBe(false);
    expect(result.previousPrice).toBeUndefined();
    expect(mockPrisma.flight.create).not.toHaveBeenCalled();
  });

  it('should show previous price when flight had prices', async () => {
    const { getFlightPrice } = await import('../../src/services/travelpayouts.js');
    vi.mocked(getFlightPrice).mockResolvedValue(MOCK_FLIGHT_RESULT);

    mockPrisma.flight.findFirst.mockResolvedValue(MOCK_FLIGHT_DB);
    mockPrisma.price.findFirst.mockResolvedValue({ amount: 10000, currency: 'RUB' });
    mockPrisma.price.create.mockResolvedValue({});
    mockPrisma.user.findUnique.mockResolvedValue(MOCK_USER);
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    mockPrisma.subscription.create.mockResolvedValue({ id: 'sub-1', isActive: true });

    const result = await createSubscription(
      BigInt(123456789),
      'SU1234',
      'SVO',
      'LED',
      '2025-12-25',
    );

    expect(result.previousPrice).toEqual({ amount: 10000, currency: 'RUB' });
  });

  it('should reactivate existing subscription', async () => {
    const { getFlightPrice } = await import('../../src/services/travelpayouts.js');
    vi.mocked(getFlightPrice).mockResolvedValue(MOCK_FLIGHT_RESULT);

    const existingSub = { id: 'sub-1', isActive: false };

    mockPrisma.flight.findFirst.mockResolvedValue(MOCK_FLIGHT_DB);
    mockPrisma.price.findFirst.mockResolvedValue(null);
    mockPrisma.price.create.mockResolvedValue({});
    mockPrisma.user.findUnique.mockResolvedValue(MOCK_USER);
    mockPrisma.subscription.findUnique.mockResolvedValue(existingSub);
    mockPrisma.subscription.update.mockResolvedValue({ id: 'sub-1', isActive: true });

    const result = await createSubscription(
      BigInt(123456789),
      'SU1234',
      'SVO',
      'LED',
      '2025-12-25',
    );

    expect(result.subscription.isActive).toBe(true);
    expect(mockPrisma.subscription.create).not.toHaveBeenCalled();
    expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sub-1' },
        data: { isActive: true },
      }),
    );
  });

  it('should throw when user not found', async () => {
    const { getFlightPrice } = await import('../../src/services/travelpayouts.js');
    vi.mocked(getFlightPrice).mockResolvedValue(MOCK_FLIGHT_RESULT);

    mockPrisma.flight.findFirst.mockResolvedValue(null);
    mockPrisma.flight.create.mockResolvedValue(MOCK_FLIGHT_DB);
    mockPrisma.price.create.mockResolvedValue({});
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(
      createSubscription(BigInt(999999), 'SU1234', 'SVO', 'LED', '2025-12-25'),
    ).rejects.toThrow(SubscriptionError);
  });
});

describe('getUserSubscriptions', () => {
  it('should return subscriptions when user found', async () => {
    const subscriptions = [
      {
        id: 'sub-1',
        flight: {
          flightNumber: 'SU1234',
          origin: 'SVO',
          destination: 'LED',
          departureDate: new Date('2025-12-25'),
          prices: [{ amount: 12450, currency: 'RUB' }],
        },
      },
    ];

    mockPrisma.user.findUnique.mockResolvedValue({ subscriptions });

    const result = await getUserSubscriptions(BigInt(123456789));

    expect(result).toHaveLength(1);
    expect(result[0].flight.flightNumber).toBe('SU1234');
  });

  it('should return empty array when user has no subscriptions', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ subscriptions: [] });

    const result = await getUserSubscriptions(BigInt(123456789));

    expect(result).toEqual([]);
  });

  it('should return empty array when user not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const result = await getUserSubscriptions(BigInt(999999));

    expect(result).toEqual([]);
  });
});

describe('deactivateSubscription', () => {
  it('should deactivate an active subscription', async () => {
    const activeSub = { id: 'sub-1', userId: 'user-1', isActive: true };
    mockPrisma.subscription.findFirst.mockResolvedValue(activeSub);
    mockPrisma.subscription.update.mockResolvedValue({ ...activeSub, isActive: false });

    const result = await deactivateSubscription('sub-1', 'user-1');

    expect(result.isActive).toBe(false);
    expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: { isActive: false },
    });
  });

  it('should throw when subscription not found', async () => {
    mockPrisma.subscription.findFirst.mockResolvedValue(null);

    await expect(deactivateSubscription('sub-1', 'user-1')).rejects.toThrow(SubscriptionError);
    expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
  });
});
