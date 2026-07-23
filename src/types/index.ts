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