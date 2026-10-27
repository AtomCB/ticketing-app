# Houselights

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
| **Redis** | Cache-aside caching, TTL-based seat holds, distributed locks, pub/sub, rate limiting, queues |
| **GraphQL** | Schema-first API design, resolvers, DataLoader batching, subscriptions, typed clients via codegen |
| **Tailwind CSS** | A custom design system with v4 theme tokens, built without a component library |

The frontend (React, TypeScript, Vite, TanStack Query, Zustand) is the familiar ground the backend work builds on.

## Status

**Phase 1 (done):** browse events, filter by city, paginate, and pick seats on an interactive seat map. Seats are drawn from real per-event inventory in Postgres, and availability counts are cached in Redis. Holding and buying seats come next; see the [roadmap](#roadmap).

## Tech stack

| Layer | Choice |
| --- | --- |
| Monorepo | pnpm workspaces (`apps/api`, `apps/web`) |
| API | Node.js, Express 5, Apollo Server 5 |
| Database | PostgreSQL 18, Drizzle ORM and Drizzle Kit migrations |
| Cache | Redis 8 via ioredis |
| Types | GraphQL Code Generator (resolver types for the API, typed documents for the web app) |
| Web | React 19, Vite 8, TypeScript, Tailwind CSS v4, React Router |
| Data fetching | TanStack Query (server state) and Zustand (client UI state) |
| Local services | Docker Compose |

## Getting started

### Prerequisites

- **Node.js 22.12 or newer.** Node 24 LTS is recommended; run `nvm use` to pick it up from `.nvmrc`.
- **pnpm 12.** Run `corepack enable` and pnpm will use the version pinned in `package.json`. If corepack isn't available, use `npm install -g pnpm`.
- **Docker Desktop** (or another Docker engine) for Postgres and Redis.

### First run

```bash
pnpm install       # install dependencies for both apps
pnpm bootstrap     # start Postgres + Redis, run migrations, seed sample data
pnpm dev           # run the API and web app together
```

Then open:

- Web app: http://localhost:5173
- GraphQL API and Apollo Sandbox: http://localhost:4000/graphql
- Health check: http://localhost:4000/health

The API works without a `.env` file because its defaults match `docker-compose.yml`. To change anything, copy `apps/api/.env.example` to `apps/api/.env`.

## Scripts

Run these from the repository root.

| Command | What it does |
| --- | --- |
| `pnpm dev` | Generate GraphQL types, then run the API (port 4000) and web app (port 5173) in watch mode |
| `pnpm bootstrap` | `services:up`, then `db:migrate`, then `db:seed` |
| `pnpm services:up` / `services:down` | Start or stop the Postgres and Redis containers |
| `pnpm services:reset` | Delete all container data and start fresh; run `db:migrate` and `db:seed` after |
| `pnpm db:generate` | Create a new SQL migration after editing `apps/api/src/db/schema.ts` |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm db:seed` | Wipe the data and load the sample venues, events and seats |
| `pnpm db:studio` | Open Drizzle Studio to browse the database |
| `pnpm codegen` | Regenerate TypeScript types from `apps/api/schema.graphql` |
| `pnpm typecheck` / `pnpm build` | Typecheck or build both apps |

## Project structure

```
apps/
  api/
    schema.graphql           The API contract. Both apps generate types from it.
    drizzle/                 Generated SQL migrations (committed)
    src/
      index.ts               Express + Apollo Server, health check, graceful shutdown
      env.ts                 Configuration with local defaults
      redis.ts               Redis client and a cache-aside helper
      db/
        schema.ts            Tables, enums, indexes and constraints
        client.ts            Connection pool and Drizzle instance
        seed.ts              Sample data
      graphql/
        resolvers.ts         Query and field resolvers, keyset pagination
        loaders.ts           DataLoaders: batch venue lookups and availability (Redis MGET + one SQL query)
        context.ts           Per-request context
  web/
    src/
      main.tsx               Router and TanStack Query setup
      lib/graphql.ts         Small typed fetch client used by every query
      stores/seatSelection.ts  Zustand store for picked seats
      routes/                Event list and event detail pages
      components/            Ticket cards, seat map, selection panel
docker-compose.yml           Postgres 18 and Redis 8
```

## How a request flows

1. A component declares its query with `graphql(...)`. `pnpm codegen` turns that into a typed document, so results and variables are fully typed.
2. TanStack Query calls `execute()` in `src/lib/graphql.ts`, which POSTs to `/graphql`. Vite proxies the request to the API in development.
3. Apollo Server runs the resolvers. Field resolvers like `Event.venue` go through DataLoaders, so a page of events makes one venue query, not one per event.
4. `Event.availability` checks Redis first with a single `MGET`, runs one grouped SQL query for any misses, and writes the results back with a 10-second TTL.

With the API running, every SQL statement is logged to the terminal. Reading those logs is one of the quickest ways to learn what the ORM is doing. Set `LOG_SQL=false` to turn them off.

## Things to explore

- Open `psql` with `docker compose exec postgres psql -U ticketing`, then run `EXPLAIN ANALYZE` on the pagination query from the logs. Check that it uses `events_starts_at_id_idx`.
- Run `docker compose exec redis redis-cli MONITOR` and reload the event list to watch the cache hits and misses.
- Stop Redis with `docker compose stop redis` and reload. The API falls back to Postgres instead of failing.
- Try to insert a duplicate `(event_id, seat_id)` row in `event_seats` and watch the unique index reject it.

## Roadmap

Each phase works on its own and is worth talking about in an interview.

- [x] **Phase 1: Catalog.** Schema and migrations, seed data, GraphQL queries, cursor pagination, DataLoader, Redis cache-aside, event list and seat map UI.
- [ ] **Phase 2: Seat holds.** A `holdSeats` mutation that reserves seats for 10 minutes. Uses Redis `SET NX EX` per seat (or a Lua script to hold several seats atomically), a Postgres transaction with `SELECT ... FOR UPDATE`, and an expiry job that releases abandoned holds. GraphQL subscriptions (graphql-ws, with Redis pub/sub across server instances) replace polling for live seat updates. Optimistic UI with rollback in TanStack Query.
- [ ] **Phase 3: Accounts and checkout.** Sign-up and sessions (stored in Redis), then Stripe test-mode checkout, a webhook handler, idempotency keys so a double click can't charge twice, and an orders table.
- [ ] **Phase 4: On-sale traffic.** Rate limiting with Redis, a virtual waiting room built on a sorted-set queue, and load testing with k6 to find the breaking point.
- [ ] **Phase 5: Production.** Tests (Vitest and Testcontainers against a real Postgres), CI with GitHub Actions, and a deployment.

## Troubleshooting

- **Port 5432 or 6379 is already in use.** Another Postgres or Redis is running locally. Stop it, or start the containers on other ports with `POSTGRES_PORT=5433 REDIS_PORT=6380 pnpm services:up` and set the matching URLs in `apps/api/.env`.
- **`Cannot find module './gql'` or missing generated types.** Run `pnpm codegen`. Generated files are not committed.
- **"The API responded with 502"** in the web app means the API isn't running. Start it with `pnpm dev`.
