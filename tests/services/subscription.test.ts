import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseFlightInput,
  getUserSubscriptions,
  deactivateSubscription,
  SubscriptionError,
} from '../../src/services/subscription.js';

const mockPrisma = vi.hoisted(() => ({
  flight: { findFirst: vi.fn(), create: vi.fn() },
  price: { create: vi.fn(), findFirst: vi.fn() },
  user: { findUnique: vi.fn() },
  subscription: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
}));

vi.mock('../../src/db/client.js', () => ({ prisma: mockPrisma }));

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
