# tg-zarya-bot

Telegram bot for tracking Aeroflot ticket prices with change notifications.

## Stack

- **Runtime:** Node.js 22 + TypeScript
- **Bot framework:** grammY
- **Database:** PostgreSQL 16 + Prisma ORM
- **Data source:** Travelpayouts API
- **Scheduler:** node-cron (price checks every hour)
- **Containerization:** Docker + docker-compose
- **CI/CD:** GitHub Actions

## Quick start

### 1. Prerequisites

- Node.js 22+
- Docker and docker-compose
- Telegram bot token (from [@BotFather](https://t.me/BotFather))
- Travelpayouts API token (register as partner at [travelpayouts.com](https://travelpayouts.com))

### 2. Setup

```bash
git clone <repo-url>
cd tg-zarya-bot

cp .env.example .env
# Fill in .env with your tokens and secrets

npm ci
npx prisma generate
npx prisma migrate deploy
```

### 3. Run locally

```bash
# Terminal 1: start PostgreSQL
docker compose up postgres -d

# Terminal 2: start bot (auto-restart on changes)
npm run dev
```

### 4. Run with Docker

```bash
docker compose up --build
```

## Commands

| Command                                | Description                       |
| -------------------------------------- | --------------------------------- |
| `/start`                               | Register and show welcome message |
| `/subscribe SU1234 SVO LED 25.12.2024` | Subscribe to a flight             |
| `/myflights`                           | List active subscriptions         |
| `/unsubscribe`                         | Unsubscribe from a flight         |

## Project structure

```
src/
├── bot/           # grammY bot setup, handlers, keyboards
│   ├── handlers/  # /start, /subscribe, /myflights, /unsubscribe, callbacks
│   └── index.ts   # Bot initialization + health check HTTP server
├── services/      # Business logic
│   ├── price-tracker.ts   # Hourly cron price checks
│   ├── notification.ts    # Sending price alerts to users
│   ├── subscription.ts    # Subscription CRUD
│   └── travelpayouts.ts   # Travelpayouts API client
├── db/            # Prisma client setup
├── config/        # Environment validation (zod)
└── types/         # Shared TypeScript types
```

## Health check

When `PORT` is set (default `3000`), the bot starts an HTTP server:

- `GET /health` — returns `{"status":"ok"}` with DB connectivity check

Used by Docker `HEALTHCHECK` and monitoring systems.

## CI/CD

On push to `main`:

1. **Test job:** typecheck, lint, format check, run migrations, run tests
2. **Deploy job:** build Docker image, push to Docker Hub, SSH into VPS and redeploy

Required GitHub secrets:

| Secret            | Description         |
| ----------------- | ------------------- |
| `DOCKER_USERNAME` | Docker Hub username |
| `DOCKER_PASSWORD` | Docker Hub password |
| `VPS_HOST`        | VPS IP address      |
| `VPS_USER`        | SSH user            |
| `VPS_SSH_KEY`     | SSH private key     |
