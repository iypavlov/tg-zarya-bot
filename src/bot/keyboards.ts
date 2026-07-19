import { InlineKeyboard } from 'grammy';

export function getMyFlightsKeyboard(
  subscriptions: Array<{ id: string; flight: { flightNumber: string } }>,
) {
  const kb = new InlineKeyboard();
  for (const sub of subscriptions) {
    kb.text(`❌ ${sub.flight.flightNumber}`, `unsub:${sub.id}`);
    kb.row();
  }
  return kb;
}

export function getUnsubConfirmKeyboard(subId: string) {
  return new InlineKeyboard()
    .text('✅ Да, отписаться', `confirm_unsub:${subId}`)
    .text('❌ Нет', 'cancel_unsub');
}

export function getFlightInfoKeyboard(flightId: string) {
  return new InlineKeyboard().text('❌ Отписаться', `unsub_from_flight:${flightId}`);
}

export function getMainMenuKeyboard() {
  return new InlineKeyboard().text('✈️ Подписаться', 'subscribe').text('📋 Мои рейсы', 'myflights');
}
