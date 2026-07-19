import { Context, SessionFlavor } from 'grammy';
import { PrismaClient } from '@prisma/client';

export interface SessionData {
  step?: string;
  flightData?: {
    flightNumber?: string;
    origin?: string;
    destination?: string;
    departureDate?: string;
  };
}

export type BotContext = Context &
  SessionFlavor<SessionData> & {
    prisma: PrismaClient;
  };
