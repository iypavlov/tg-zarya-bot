import { Bot, session } from 'grammy';
import { config } from '../config/index.js';
import { prisma } from '../db/client.js';
import { registerHandlers } from './handlers/index.js';
import { startPriceTracker } from '../services/price-tracker.js';
import type { BotContext, SessionData } from './context.js';

const bot = new Bot<BotContext>(config.BOT_TOKEN);

bot.use(session({ initial: (): SessionData => ({}) }));

bot.use(async (ctx, next) => {
  ctx.prisma = prisma;
  await next();
});

registerHandlers(bot);

bot.catch((err) => {
  console.error('Bot error:', err);
});

const PORT = process.env.PORT ? Number(process.env.PORT) : undefined;

startPriceTracker(bot);

if (PORT) {
  bot.start({ onStart: () => console.log(`Bot started on port ${PORT}`) });
} else {
  bot.start({ onStart: () => console.log('Bot started (polling)') });
}
