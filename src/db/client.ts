import { PrismaClient } from '@prisma/client';
import { config } from '../config/index.js';

export const prisma = new PrismaClient({
  datasourceUrl: config.DATABASE_URL,
});
