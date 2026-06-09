# Water Quality Map

Next.js 16 water quality map application with Prisma + MySQL, optimized for LINE LIFF mobile usage.

## Stack

- Next.js 16.2.4
- React 19
- TypeScript 5
- Tailwind CSS 4
- Prisma 5
- MySQL 8
- Docker Compose for local development and deployment handoff

## Project Modes

- `docker-compose.yml` is the default development setup with hot reload, MySQL, and phpMyAdmin.
- `docker-compose.prod.yml` is the deployment-oriented setup with a production build and a separate database setup step.

## Environment Setup

1. Create your local env file:

```powershell
Copy-Item .env.example .env
```

2. Update values in `.env` as needed.

Important notes:

- `NEXT_PUBLIC_LIFF_ID` is used in client code, so it is embedded during the production image build.
- `DATABASE_URL` is for running the app from your host machine with `npm`.
- `DATABASE_URL_DOCKER` is for containers talking to MySQL over the Docker network.

## Development with Docker

Start the full development stack:

```bash
docker compose up --build
```

Services:

- App: `http://localhost:3000`
- phpMyAdmin: `http://localhost:8080`
- MySQL: `localhost:3307`

What this does:

- Starts MySQL in Docker
- Runs `prisma db push` automatically for local development
- Starts Next.js in dev mode with hot reload

Stop the stack:

```bash
docker compose down
```

Stop and remove volumes:

```bash
docker compose down -v
```

## Development without Docker

If you want to run the app on your host machine but keep MySQL in Docker:

```bash
docker compose up -d mysql phpmyadmin
npm ci
npx prisma generate
npx prisma db push
npm run dev
```

This uses `DATABASE_URL` from `.env`, which should point to `127.0.0.1:3307`.

## Deployment with Docker

Build and run the production-oriented stack:

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

What this does:

- Builds the production Next.js image
- Injects `NEXT_PUBLIC_LIFF_ID` at build time
- Runs a one-off `db-setup` container for `prisma db push`
- Starts the app with `npm run start`
- Keeps MySQL internal to the Docker network by default

Stop the deployment stack:

```bash
docker compose -f docker-compose.prod.yml down
```

Remove deployment volumes:

```bash
docker compose -f docker-compose.prod.yml down -v
```

## Useful Commands

```bash
npm run lint
npm run seed
```

## Git Handoff Checklist

Before sending this repository to another developer:

- Commit `Dockerfile`, `docker-compose.yml`, `docker-compose.prod.yml`, `.dockerignore`, `.env.example`, and `README.md`
- Do not commit `.env`
- Make sure the recipient knows whether they should use the dev stack or the production stack

## Notes for Production

- The production compose file currently includes MySQL for a self-contained deployment. If you already have a managed MySQL instance, replace `DATABASE_URL_DOCKER` and remove the `mysql` service.
- For internet-facing deployment, place a reverse proxy such as Nginx in front of the Next.js container.
