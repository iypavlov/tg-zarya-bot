import type { Bot } from 'grammy';
import type { BotContext, CachedTicket } from '../context.js';
import {
  parseFlightInput,
  SubscriptionError,
} from '../../services/subscription.js';
import { searchFlights, getFlightPrice } from '../../services/travelpayouts.js';
import type { FlightPriceResult } from '../../types/index.js';
import {
  getMainMenuKeyboard,
  getTicketSelectionKeyboard,
} from '../keyboards.js';
import { safeEditMessageText } from '../helpers.js';

const SEPARATOR = '\n╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌\n';

function formatPrice(amount: number, currency: string): string {
  return `${Number(amount).toLocaleString('ru-RU')} ${currency}`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function formatTransferTag(transfers: number): string {
  if (transfers === 0) return '🟢 прямой';
  if (transfers === 1) return '🟡 1 пересадка';
  return `🔴 ${transfers} пересадки`;
}

function cacheResult(r: FlightPriceResult): CachedTicket {
  return {
    flightNumber: r.flightNumber,
    airline: r.airline,
    origin: r.origin,
    destination: r.destination,
    departureDate: r.departureDate.toISOString(),
    amount: r.amount,
    currency: r.currency,
    transfers: r.transfers,
  };
}

async function showTicketList(ctx: BotContext, results: FlightPriceResult[]) {
  const maxResults = Math.min(results.length, 6);
  const limited = results.slice(0, maxResults);

  const lines = limited.map((r, i) => {
    const dateStr = formatDate(r.departureDate);
    const time = formatTime(r.departureDate);
    const price = formatPrice(r.amount, r.currency);
    const tag = formatTransferTag(r.transfers);
    return (
      `✈️ <b>${i + 1}. ${r.flightNumber}</b>\n` +
      `   🛫 ${r.origin} → 🛬 ${r.destination}  ·  🏢 ${r.airline}\n` +
      `   📅 ${dateStr}  ·  🕐 ${time}\n` +
      `   💰 <b>${price}</b>  ·  ${tag}`
    );
  });

  const text =
    `🎯 <b>Найдено билетов: ${results.length}</b>\n${lines.join(SEPARATOR)}\n\nВыберите билет для отслеживания:`;

  const keyboard = getTicketSelectionKeyboard(limited);

  const opts: Parameters<BotContext['reply']>[1] & { reply_markup: ReturnType<typeof getTicketSelectionKeyboard> } = {
    reply_markup: keyboard,
    parse_mode: 'HTML',
  };

  if (ctx.callbackQuery) {
    await safeEditMessageText(ctx, text, opts);
  } else {
    await ctx.reply(text, opts);
  }
}

export function registerSubscribeHandler(bot: Bot<BotContext>) {
  bot.on('message:text', async (ctx) => {
    if (ctx.session.step !== 'awaiting_flight') return;

    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const parsed = parseFlightInput(ctx.message.text);
    if (!parsed) {
      await ctx.reply(
        'Не удалось распознать формат. Попробуйте ещё раз.',
        { parse_mode: 'Markdown' },
      );
      return;
    }

    ctx.session.step = undefined;
    ctx.session.flightData = {};
    ctx.session.searchResults = undefined;

    const statusMsg = await ctx.reply('Ищу билеты...');

    try {
      let results: FlightPriceResult[];

      if (parsed.flightNumber) {
        const result = await getFlightPrice(
          parsed.flightNumber,
          parsed.origin,
          parsed.destination,
          parsed.departureDate,
        );
        results = result ? [result] : [];
      } else {
        results = await searchFlights({
          origin: parsed.origin,
          destination: parsed.destination,
          departureDate: parsed.departureDate,
        });
      }

      await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});

      if (results.length === 0) {
        await ctx.reply('Билеты не найдены по заданному направлению на указанную дату.', {
          reply_markup: getMainMenuKeyboard(),
        });
        return;
      }

      ctx.session.searchResults = results.map(cacheResult);
      ctx.session.flightData = {
        flightNumber: parsed.flightNumber,
        origin: parsed.origin,
        destination: parsed.destination,
        departureDate: parsed.departureDate,
      };

      await showTicketList(ctx, results);
    } catch (err) {
      await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});

      if (err instanceof SubscriptionError) {
        await ctx.reply(err.message, { reply_markup: getMainMenuKeyboard() });
      } else {
        console.error('Subscribe error:', err);
        await ctx.reply('Произошла ошибка при поиске билетов. Попробуйте позже.', {
          reply_markup: getMainMenuKeyboard(),
        });
      }
    }
  });
}
