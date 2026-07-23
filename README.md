<div align="center">

# tg-zarya-bot

Telegram-бот для отслеживания цен на авиабилеты с автоматическими уведомлениями об изменениях.

[![Node.js](https://img.shields.io/badge/Node.js-22-3c873a?style=flat-square&logo=node.js)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org)
[![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io)
[![grammY](https://img.shields.io/badge/grammY-0088CC?style=flat-square&logo=telegram)](https://grammy.dev)
![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)

</div>

## Overview

tg-zarya-bot — это бот для Telegram, который помогает отслеживать цены на авиабилеты. Пользователь может найти рейс по направлению и дате, подписаться на него, а бот будет автоматически проверять цену каждый час и присылать уведомление, если она изменилась.

## Features

- **Поиск билетов** — поиск по направлению и дате через Travelpayouts API
- **Автоматический мониторинг** — проверка цен каждый час с помощью node-cron
- **Уведомления об изменениях** — бот присылает сообщение при повышении или понижении цены
- **Inline-интерфейс** — всё управление через кнопки под сообщениями

## Getting started

### Prerequisites

- Node.js 22
- Docker и docker-compose
- Токен бота от [@BotFather](https://t.me/BotFather)
- Токен Travelpayouts ([регистрация](https://travelpayouts.com))

### Setup

```bash
git clone <repo-url>
cd tg-zarya-bot

cp .env.example .env
# Заполните .env — BOT_TOKEN, TRAVELPAYOUTS_TOKEN, DATABASE_URL и др.

npm ci
npx prisma generate
npx prisma migrate deploy
```

### Run locally

```bash
docker compose up postgres -d
npm run dev
```

### Run with Docker

```bash
docker compose up --build
```

## Usage

Бот использует inline-клавиатуру. Основные сценарии:

| Действие | Описание |
|---|---|
| `/start` | Регистрация и главное меню |
| «Подписаться» | Ввести данные рейса (`SU1234 SVO LED 25.12.2024`) |
| «Мои подписки» | Список активных подписок с возможностью отписки |
| «Помощь» | Справка |

> [!TIP]
> Формат ввода рейса: `[НОМЕР_РЕЙСА] ОТКУДА КУДА ДАТА`. Номер рейса опционален. Примеры: `SU1234 SVO LED 25.12.2024` или `SVO LED 2024-12-25`.

## Tech stack

| | |
|---|---|
| **Runtime** | Node.js 22 + TypeScript |
| **Bot framework** | [grammY](https://grammy.dev) |
| **Database** | PostgreSQL 16 + [Prisma](https://prisma.io) ORM |
| **Data source** | [Travelpayouts API](https://travelpayouts.com) |
| **Scheduler** | node-cron (каждый час) |
| **Tests** | Vitest |
| **Containerization** | Docker + docker-compose |
| **CI/CD** | GitHub Actions |

## Project structure

```
src/
├── bot/          # Инициализация бота, хендлеры, клавиатуры
├── services/     # Бизнес-логика (трекер цен, нотификации, подписки, API-клиент)
├── config/       # Валидация окружения (zod)
├── db/           # Prisma client
└── types/        # Общие типы
tests/            # Юнит-тесты (Vitest)
```

## Scripts

| Команда | Описание |
|---|---|
| `npm run dev` | Запуск с hot reload |
| `npm run build` | Сборка TypeScript |
| `npm test` | Запуск тестов |
| `npm run lint` | Линтер (ESLint) |
| `npm run typecheck` | Проверка типов |

## CI/CD

При пуше тега `v*` (например `v1.0.0`) GitHub Actions:

1. Запускает typecheck, lint и тесты
2. Архивирует код и копирует на VPS через SCP
3. Запускает `docker compose up -d --build`

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `BOT_TOKEN` | Yes | Telegram bot token |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `TRAVELPAYOUTS_TOKEN` | Yes | Travelpayouts API token |
| `BOT_ADMIN_ID` | Yes | Admin Telegram ID |
| `POSTGRES_DB` | Yes | PostgreSQL database name |
| `POSTGRES_USER` | Yes | PostgreSQL user |
| `POSTGRES_PASSWORD` | Yes | PostgreSQL password |
| `PORT` | No | Health check port (default 3000) |
| `LOG_LEVEL` | No | Logging level (default info) |