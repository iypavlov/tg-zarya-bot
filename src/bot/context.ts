import { Context, SessionFlavor } from 'grammy';
import { PrismaClient } from '@prisma/client';

export interface CachedTicket {
  flightNumber: string;
  airline: string;
  origin: string;
  destination: string;
  departureDate: string;
  amount: number;
  currency: string;
  transfers: number;
}

export interface SessionData {
  step?: string;
  flightData?: {
    flightNumber?: string;
    origin?: string;
    destination?: string;
    departureDate?: string;
  };
  searchResults?: CachedTicket[];
}

export type BotContext = Context &
  SessionFlavor<SessionData> & {
    prisma: PrismaClient;
  };
