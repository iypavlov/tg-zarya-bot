import { InlineKeyboard } from 'grammy';

export function getMainMenuKeyboard() {
  return new InlineKeyboard()
    .text('✈️ Подписаться на рейс', 'subscribe')
    .row()
    .text('📋 Мои подписки', 'myflights')
    .row()
    .text('❓ Помощь', 'help');
}

export const MAIN_MENU_TEXT =
  '🌅 Добро пожаловать в Зарю!\n\n' +
  'Я отслеживаю цены на авиабилеты и уведомляю об изменениях.\n\n' +
  'Выберите действие:';

export function getTicketSelectionKeyboard(
  tickets: Array<{ flightNumber: string; amount: number; currency: string; transfers: number }>,
) {
  const kb = new InlineKeyboard();
  tickets.forEach((t, i) => {
    const priceStr = `${Number(t.amount).toLocaleString('ru-RU')} ${t.currency}`;
    const tag = t.transfers === 0 ? 'прямой' : `${t.transfers} пер.`;
    kb.text(`${i + 1}. ${t.flightNumber} — ${priceStr} (${tag})`, `select_ticket:${i}`);
    kb.row();
  });
  kb.text('<< Назад', 'menu');
  return kb;
}

export function getMyFlightsKeyboard(
  subscriptions: Array<{ id: string; flight: { flightNumber: string; origin: string; destination: string } }>,
) {
  const kb = new InlineKeyboard();
  for (const sub of subscriptions) {
    kb.text(
      `❌ ${sub.flight.flightNumber} · ${sub.flight.origin}→${sub.flight.destination}`,
      `unsub:${sub.id}`,
    );
    kb.row();
  }
  kb.text('<< Назад', 'menu');
  return kb;
}

export function getUnsubConfirmKeyboard(subId: string) {
  return new InlineKeyboard()
    .text('✅ Да, отписаться', `confirm_unsub:${subId}`)
    .text('❌ Нет', 'cancel_unsub');
}

export function getFlightInputKeyboard() {
  return new InlineKeyboard().text('❌ Отмена', 'menu');
}

export function getSubscriptionResultKeyboard() {
  return new InlineKeyboard()
    .text('📋 Мои подписки', 'myflights')
    .text('🏠 Главное меню', 'menu');
}
