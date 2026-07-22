import { Bot, session } from 'grammy';
import { createServer } from 'node:http';
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
  createServer(async (req, res) => {
    if (req.url === '/health') {
      try {
        await prisma.$queryRaw`SELECT 1`;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
      } catch {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', message: 'database unreachable' }));
      }
    } else {
      res.writeHead(404);
      res.end();
    }
  }).listen(PORT, () => console.log(`Bot started, health check on port ${PORT}`));

  void bot.start();
} else {
  void bot.start({ onStart: () => console.log('Bot started (polling)') });
}
