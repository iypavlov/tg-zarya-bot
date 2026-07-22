import { BotContext } from '../context.js';

export function registerStartHandler(bot: {
  command: (cmd: string, handler: (ctx: BotContext) => void) => void;
}) {
  bot.command('start', async (ctx: BotContext) => {
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

    await ctx.reply(
      'Добро пожаловать в zarya Bot! 🛫\n\n' +
        'Я отслеживаю цены на билеты Аэрофлота и уведомляю об изменениях.\n\n' +
        'Доступные команды:\n' +
        '/subscribe — подписаться на рейс\n' +
        '/myflights — мои подписки\n' +
        '/unsubscribe — отписаться от рейса\n' +
        '/help — справка',
    );
  });

  bot.command('help', async (ctx: BotContext) => {
    await ctx.reply(
      'Доступные команды:\n\n' +
        '/start — приветствие\n' +
        '/subscribe — подписаться на рейс\n' +
        '/myflights — мои подписки\n' +
        '/unsubscribe — отписаться от рейса\n' +
        '/help — эта справка',
    );
  });
}
