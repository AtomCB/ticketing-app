# Usher

An event ticketing app: browse shows, pick seats on a live seat map, hold them for a few minutes and check out. A full-stack TypeScript monorepo with a GraphQL API on Postgres and Redis, and a React frontend.

## Project goal

This project exists to build real backend experience on top of existing frontend skills, and to have something concrete to point to in full-stack interviews.

Ticketing was chosen because it can't be built well without solving the problems backend engineers are actually hired to solve:

- **Correctness under concurrency.** Two people click the same seat at the same moment, and exactly one of them gets it. That takes Postgres transactions, row locks and constraints, not just application code.
- **State that expires.** A held seat must return to the pool after 10 minutes, even if the user closes the tab. Redis TTLs and background jobs handle that.
- **Money.** Checkout means payment webhooks, idempotency keys and keeping the payment provider and the database in agreement.
- **Traffic spikes.** A popular on-sale draws far more users than seats. Caching, rate limiting and a waiting-room queue keep the system up and fair.

"Design Ticketmaster" is also one of the most common system-design interview questions, so the aim is to answer it from experience rather than from a prep guide.

The specific skills this project practices:

| Area | What it's used for here |
| --- | --- |
| **PostgreSQL** | Relational modeling, migrations, constraints, indexes, keyset pagination, transactions and row locking |
| **Redis** | Cache-aside caching, sessions, TTL-based expiry, pub/sub, rate limiting, queues |
| **GraphQL** | Schema-first API design, resolvers, DataLoader batching, subscriptions, typed clients via codegen |
| **Tailwind CSS** | A custom design system with v4 theme tokens, built without a component library |

The frontend (React, TypeScript, Vite, TanStack Query, Zustand) is the familiar ground the backend work builds on. Everything beyond the starting skeleton is built by hand, following [BUILD_PLAN.md](BUILD_PLAN.md).

## Status

**Skeleton.** Every service runs and is wired together end to end, proven by a health check page. The schema, API, caching and UI are built milestone by milestone; see [BUILD_PLAN.md](BUILD_PLAN.md) and the [UI mocks](https://claude.ai/artifact/QS7H9cFWNASXjXmbyuvah5).

## Tech stack

| Layer | Choice |
| --- | --- |
| Monorepo | pnpm workspaces (`apps/api`, `apps/web`) |
| API | Node.js, Express 5, Apollo Server 5 |
| Database | PostgreSQL 18, Drizzle ORM and Drizzle Kit migrations |
| Cache and queues | Redis 8 via ioredis |
| Types | GraphQL Code Generator (resolver types for the API, typed documents for the web app) |
| Web | React 19, Vite 8, TypeScript, Tailwind CSS v4, React Router |
| Data fetching | TanStack Query (server state) and Zustand (client UI state) |
| Local services | Docker Compose |

## Getting started

### Prerequisites

- **Node.js 22.12 or newer.** Node 24 LTS is recommended; run `nvm use` to pick it up from `.nvmrc`.
- **pnpm 12.** Run `corepack enable` and pnpm will use the version pinned in `package.json`. If corepack isn't available, use `npm install -g pnpm`.
- **A Docker engine**, such as [Docker Desktop](https://www.docker.com/products/docker-desktop/) or [OrbStack](https://orbstack.dev). Open the app once after installing so the `docker` command is set up, and keep it running while you work.

### First run

```bash
pnpm install        # install dependencies for both apps
pnpm services:up    # start Postgres and Redis in Docker
pnpm dev            # run the API and web app together
```

Then open:

- Web app: http://localhost:5173 (shows whether the API, Postgres and Redis are reachable)
- GraphQL API and Apollo Sandbox: http://localhost:4000/graphql
- Health check: http://localhost:4000/health

The API works without a `.env` file because its defaults match `docker-compose.yml`. To change anything, copy `apps/api/.env.example` to `apps/api/.env`.

Recommended VS Code extensions: Tailwind CSS IntelliSense (`bradlc.vscode-tailwindcss`) and GraphQL (`graphql.vscode-graphql` and `graphql.vscode-graphql-syntax`). The included `graphql.config.yml` gives you autocomplete and validation inside `graphql(...)` queries.

## Scripts

Run these from the repository root.

| Command | What it does |
| --- | --- |
| `pnpm dev` | Generate GraphQL types, then run the API (port 4000) and web app (port 5173) in watch mode |
| `pnpm services:up` / `services:down` | Start or stop the Postgres and Redis containers |
| `pnpm services:reset` | Delete all container data and start fresh |
| `pnpm db:generate` | Create a SQL migration from `apps/api/src/db/schema.ts` |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm db:seed` | Run `apps/api/src/db/seed.ts` |
| `pnpm db:studio` | Open Drizzle Studio to browse the database |
| `pnpm codegen` | Regenerate TypeScript types from `apps/api/schema.graphql` |
| `pnpm typecheck` / `pnpm build` | Typecheck or build both apps |

## Project structure

```
apps/
  api/
    schema.graphql           The API contract. Both apps generate types from it.
    src/
      index.ts               Express + Apollo Server, health check, graceful shutdown
      env.ts                 Configuration with local defaults
      health.ts              Postgres and Redis connectivity check
      redis.ts               Redis client
      db/
        schema.ts            Your tables (milestone 1)
        client.ts            Connection pool and Drizzle instance
        seed.ts              Your seed script (milestone 2)
        seed-data.json       Sample venues and events to seed
      graphql/
        resolvers.ts         Resolvers (starts with health only)
        context.ts           Per-request context
  web/
    src/
      main.tsx               Router and TanStack Query setup
      HealthPage.tsx         Placeholder page proving the stack works
      lib/graphql.ts         Small typed fetch client for GraphQL
      index.css              Tailwind import and your theme tokens
docker-compose.yml           Postgres 18 and Redis 8
BUILD_PLAN.md                What to build, in order
```

## Troubleshooting

- **`docker: command not found`.** Install Docker Desktop or OrbStack and open it once. If Docker Desktop is installed, check Settings, then Advanced, and set the CLI tools install to System.
- **Port 5432 or 6379 is already in use.** Another Postgres or Redis is running locally. Stop it, or start the containers on other ports with `POSTGRES_PORT=5433 REDIS_PORT=6380 pnpm services:up` and set the matching URLs in `apps/api/.env`.
- **`Cannot find module './gql'` or missing generated types.** Run `pnpm codegen`. Generated files are not committed.
- **`db:migrate` fails before milestone 1.** That's expected: there are no migrations until you define tables and run `pnpm db:generate`.
- **"The API responded with 502"** in the web app means the API isn't running. Start it with `pnpm dev`.
