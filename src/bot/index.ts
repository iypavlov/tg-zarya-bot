import { Bot, session } from 'grammy';
import { config } from '../config/index.js';
import { prisma } from '../db/client.js';
import { registerStartHandler } from './handlers/start.js';
import type { BotContext, SessionData } from './context.js';

const bot = new Bot<BotContext>(config.BOT_TOKEN);

bot.use(session({ initial: (): SessionData => ({}) }));

bot.use(async (ctx, next) => {
  ctx.prisma = prisma;
  await next();
});

registerStartHandler(bot);

bot.catch((err) => {
  console.error('Bot error:', err);
});

const PORT = process.env.PORT ? Number(process.env.PORT) : undefined;

if (PORT) {
  bot.start({ onStart: () => console.log(`Bot started on port ${PORT}`) });
} else {
  bot.start({ onStart: () => console.log('Bot started (polling)') });
}
