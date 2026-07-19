import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  searchFlights,
  getFlightPrice,
  TravelpayoutsError,
} from '../../src/services/travelpayouts.js';

vi.mock('../../src/config/index.js', () => ({
  config: {
    TRAVELPAYOUTS_TOKEN: 'test-token-123',
  },
}));

function mockFetch(responseData: unknown, ok = true) {
  return vi.mocked(fetch).mockResolvedValueOnce({
    ok,
    status: ok ? 200 : 401,
    json: () => Promise.resolve(responseData),
  } as Response);
}

const mockTicket = {
  flight_number: 'SU1234',
  airline: 'SU',
  origin: 'SVO',
  destination: 'LED',
  departure_at: '2025-12-25T10:00:00+03:00',
  price: 12450,
  currency: 'rub',
  transfers: 0,
  trip_class: 0,
  return_at: '',
  found_at: '2025-12-01T12:00:00+03:00',
  number_of_changes: 0,
};

const mockTicketBusiness = {
  flight_number: 'SU1234',
  airline: 'SU',
  origin: 'SVO',
  destination: 'LED',
  departure_at: '2025-12-25T14:00:00+03:00',
  price: 45000,
  currency: 'rub',
  transfers: 0,
  trip_class: 1,
  return_at: '',
  found_at: '2025-12-01T12:00:00+03:00',
  number_of_changes: 0,
};

beforeEach(() => {
  vi.restoreAllMocks();
  globalThis.fetch = vi.fn();
});

describe('searchFlights', () => {
  it('should return flight prices for a given route', async () => {
    mockFetch({ success: true, data: [mockTicket] });

    const results = await searchFlights({
      origin: 'SVO',
      destination: 'LED',
      departureDate: '2025-12-25',
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      flightNumber: 'SU1234',
      airline: 'SU',
      origin: 'SVO',
      destination: 'LED',
      departureDate: new Date('2025-12-25T10:00:00+03:00'),
      amount: 12450,
      currency: 'RUB',
      transfers: 0,
    });
  });

  it('should filter by flight number when specified', async () => {
    mockFetch({ success: true, data: [mockTicket, mockTicketBusiness] });

    const results = await searchFlights({
      origin: 'SVO',
      destination: 'LED',
      departureDate: '2025-12-25',
      flightNumber: 'SU1234',
    });

    expect(results).toHaveLength(2);
  });

  it('should return empty array when flight number does not match', async () => {
    const otherTicket = { ...mockTicket, flight_number: 'DP5678' };
    mockFetch({ success: true, data: [otherTicket] });

    const results = await searchFlights({
      origin: 'SVO',
      destination: 'LED',
      departureDate: '2025-12-25',
      flightNumber: 'SU9999',
    });

    expect(results).toHaveLength(0);
  });

  it('should throw on API error response', async () => {
    mockFetch({ success: false, error: 'Invalid token' });

    await expect(
      searchFlights({ origin: 'SVO', destination: 'LED', departureDate: '2025-12-25' }),
    ).rejects.toThrow(TravelpayoutsError);
  });

  it('should throw on HTTP error', async () => {
    mockFetch({ success: false, error: 'Unauthorized' }, false);

    await expect(
      searchFlights({ origin: 'SVO', destination: 'LED', departureDate: '2025-12-25' }),
    ).rejects.toThrow(TravelpayoutsError);
  });

  it('should throw on network error', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network failure'));

    await expect(
      searchFlights({ origin: 'SVO', destination: 'LED', departureDate: '2025-12-25' }),
    ).rejects.toThrow(TravelpayoutsError);
  });
});

describe('getFlightPrice', () => {
  it('should return a single flight price result', async () => {
    mockFetch({ success: true, data: [mockTicket] });

    const result = await getFlightPrice('SU1234', 'SVO', 'LED', '2025-12-25');

    expect(result).not.toBeNull();
    expect(result!.flightNumber).toBe('SU1234');
    expect(result!.amount).toBe(12450);
  });

  it('should return null when no flight found', async () => {
    mockFetch({ success: true, data: [] });

    const result = await getFlightPrice('SU9999', 'SVO', 'LED', '2025-12-25');

    expect(result).toBeNull();
  });
});
