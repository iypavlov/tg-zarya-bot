export interface FlightData {
  flightNumber: string;
  origin: string;
  destination: string;
  departureDate: string;
  airline: string;
}

export interface PriceData {
  amount: number;
  currency: string;
  fareClass?: string;
  source: string;
}

export interface SubscriptionData {
  userId: string;
  flightId: string;
  isActive: boolean;
  notifyOnChange: boolean;
  notifyDaily: boolean;
}

export interface TravelpayoutsSearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  flightNumber?: string;
}

export interface FlightPriceResult {
  flightNumber: string;
  airline: string;
  origin: string;
  destination: string;
  departureDate: Date;
  amount: number;
  currency: string;
  transfers: number;
}
