import { GrammyError } from 'grammy';
import type { BotContext } from './context.js';

export async function safeEditMessageText(ctx: BotContext, text: string, extra?: Parameters<BotContext['editMessageText']>[1]) {
  try {
    await ctx.editMessageText(text, extra);
  } catch (err) {
    if (err instanceof GrammyError && err.error_code === 400 && err.description.includes('message is not modified')) {
      return;
    }
    throw err;
  }
}
