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
