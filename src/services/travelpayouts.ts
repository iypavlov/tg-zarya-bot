import { config } from '../config/index.js';
import type { FlightPriceResult, TravelpayoutsSearchParams } from '../types/index.js';

const BASE_URL = 'https://api.travelpayouts.com';

interface TravelpayoutsTicket {
  flight_number: string;
  airline: string;
  origin: string;
  destination: string;
  origin_airport?: string;
  destination_airport?: string;
  departure_at: string;
  price: number;
  currency?: string;
  transfers: number;
  trip_class: number;
  return_at: string;
  found_at: string;
  number_of_changes: number;
}

interface TravelpayoutsResponse {
  success: boolean;
  data?: TravelpayoutsTicket[];
  error?: string;
  currency?: string;
}

export class TravelpayoutsError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'TravelpayoutsError';
  }
}

export async function searchFlights(
  params: TravelpayoutsSearchParams,
): Promise<FlightPriceResult[]> {
  const url = new URL(`${BASE_URL}/aviasales/v3/prices_for_dates`);

  url.searchParams.set('origin', params.origin);
  url.searchParams.set('destination', params.destination);
  url.searchParams.set('departure_at', params.departureDate);
  url.searchParams.set('one_way', 'true');
  url.searchParams.set('direct', 'true');
  url.searchParams.set('currency', 'rub');
  url.searchParams.set('limit', '20');
  url.searchParams.set('token', config.TRAVELPAYOUTS_TOKEN);

  let response: Response;

  try {
    response = await fetch(url.toString());
  } catch (err) {
    throw new TravelpayoutsError(
      `Network error: ${err instanceof Error ? err.message : 'Unknown error'}`,
    );
  }

  if (!response.ok) {
    throw new TravelpayoutsError(`API responded with status ${response.status}`, response.status);
  }

  const json = (await response.json()) as TravelpayoutsResponse;

  if (!json.success || !json.data) {
    throw new TravelpayoutsError(json.error ?? 'Unknown API error');
  }

  let tickets = json.data;

  if (params.flightNumber) {
    const numPart = params.flightNumber.replace(/^[A-Z]+/, '');
    tickets = tickets.filter((t) => t.flight_number === numPart);
  }

  return tickets.map((t) => ({
    flightNumber: `${t.airline}${t.flight_number}`,
    airline: t.airline,
    origin: t.origin_airport ?? t.origin,
    destination: t.destination_airport ?? t.destination,
    departureDate: new Date(t.departure_at),
    amount: t.price,
    currency: (t.currency ?? json.currency ?? 'rub').toUpperCase(),
    transfers: t.transfers,
  }));
}

export async function getFlightPrice(
  flightNumber: string,
  origin: string,
  destination: string,
  departureDate: string,
): Promise<FlightPriceResult | null> {
  const results = await searchFlights({ origin, destination, departureDate, flightNumber });
  return results[0] ?? null;
}
