import type { Bot } from 'grammy';
import type { BotContext } from '../context.js';
import { registerStartHandler } from './start.js';
import { registerSubscribeHandler } from './subscribe.js';
import { registerMyFlightsHandler } from './my-flights.js';
import { registerUnsubscribeHandler } from './unsubscribe.js';
import { registerCallbackHandler } from './callbacks.js';

const handlers = [
  registerStartHandler,
  registerSubscribeHandler,
  registerMyFlightsHandler,
  registerUnsubscribeHandler,
  registerCallbackHandler,
] as const;

export function registerHandlers(bot: Bot<BotContext>) {
  for (const fn of handlers) fn(bot);
}
