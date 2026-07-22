import type { Bot } from 'grammy';
import type { BotContext } from '../context.js';
import { getMainMenuKeyboard, MAIN_MENU_TEXT } from '../keyboards.js';

export function registerStartHandler(bot: Bot<BotContext>) {
  bot.command('start', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const existing = await ctx.prisma.user.findUnique({
      where: { telegramId },
    });

    if (!existing) {
      await ctx.prisma.user.create({
        data: {
          telegramId,
          username: ctx.from?.username,
          firstName: ctx.from?.first_name,
        },
      });
    }

    await ctx.reply(MAIN_MENU_TEXT, { reply_markup: getMainMenuKeyboard() });
  });

}
