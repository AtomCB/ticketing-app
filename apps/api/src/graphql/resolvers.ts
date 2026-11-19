import { GraphQLError } from "graphql";
import { DateTimeResolver } from "graphql-scalars";
import {
  and,
  asc,
  DrizzleQueryError,
  eq,
  getTableColumns,
  inArray,
  sql,
  type SQL,
} from "drizzle-orm";
import type { Resolvers } from "../generated/graphql.js";
import { checkHealth } from "../health.js";
import {
  events,
  eventSeats,
  holds,
  seats,
  sections,
  users,
  venues,
} from "../db/schema.js";
import type { DB } from "../db/client.js";
import { holdSeats, MAX_SEATS_PER_HOLD } from "../db/holds.js";
import { activeHold, seatStatusSql } from "../db/seatStatus.js";
import { decodeCursor, encodeCursor } from "./cursor.js";
import { hashPassword, newPasswordProblem, verifyPassword } from "../auth/passwords.js";
import { clearSessionCookie, createSession, destroySession, setSessionCookie } from "../auth/sessions.js";
import { requireUser, type CurrentUser } from "./context.js";

/** Largest page a client can ask for, so one request can't pull the whole table. */
const MAX_PAGE_SIZE = 50;

/** True if a query failed because it would have broken a unique constraint. */
function isUniqueViolation(err: unknown): boolean {
  // Drizzle wraps the driver's error; the Postgres details are on `cause`.
  const dbError = err instanceof DrizzleQueryError ? err.cause : err;
  return (
    typeof dbError === "object" &&
    dbError !== null &&
    "code" in dbError &&
    dbError.code === "23505" // Postgres: unique_violation
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Event seats as the API returns them (EventSeat), in seat-map order. Used by Event.seats
 * and by holdSeats' results. Status includes whether each seat is in an active hold.
 */
function selectEventSeats(db: DB, where: SQL | undefined) {
  return db
    .select({
      id: eventSeats.id,
      section: sections.name,
      row: seats.rowLabel,
      number: seats.seatNumber,
      priceCents: eventSeats.priceCents,
      status: seatStatusSql,
    })
    .from(eventSeats)
    .innerJoin(seats, eq(eventSeats.seatId, seats.id))
    .innerJoin(sections, eq(seats.sectionId, sections.id))
    .leftJoin(holds, activeHold)
    .where(where)
    .orderBy(asc(sections.sortOrder), asc(seats.rowLabel), asc(seats.seatNumber));
}

/** The form every email is stored and looked up in. */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// `Resolvers` is generated from schema.graphql, so TypeScript will flag any resolver
// that doesn't match the schema. Add a field to the schema, run `pnpm codegen`,
// and the compiler tells you which resolver to write.
export const resolvers: Resolvers = {
  DateTime: DateTimeResolver,

  // Translate between GraphQL enum names and the lowercase values stored in Postgres.
  EventStatus: {
    SCHEDULED: "scheduled",
    ON_SALE: "on_sale",
    SOLD_OUT: "sold_out",
    CANCELLED: "cancelled",
  },
  SeatStatus: { AVAILABLE: "available", HELD: "held", SOLD: "sold" },

  Query: {
    health: () => checkHealth(),
    me: (_parent, _args, { user }) => user,
    event: async (_parent, { id }, { db }) => {
      const [row] = await db
        .select()
        .from(events)
        .where(eq(events.id, id))
        .limit(1);
      return row ?? null;
    },
    // Keyset (cursor) pagination. Each page asks for "the next `first` events after
    // this position", never "skip N rows", so it stays fast however deep you page and
    // can't repeat or skip an event when events are added or removed between pages.
    events: async (_parent, { first, after, city }, { db }) => {
      if (first < 1 || first > MAX_PAGE_SIZE) {
        throw new GraphQLError(`first must be between 1 and ${MAX_PAGE_SIZE}`, {
          extensions: { code: "BAD_USER_INPUT", argumentName: "first" },
        });
      }

      const conditions: SQL[] = [];
      if (city) {
        conditions.push(eq(venues.city, city));
      }

      if (after) {
        const position = decodeCursor(after); // throws BAD_USER_INPUT on a bad cursor
        // Row comparison: true when the event sorts after the cursor in
        // (starts_at, id) order, the same order as orderBy below. It means
        // starts_at > x OR (starts_at = x AND id > y), in a form Postgres can answer
        // straight from an index on (starts_at, id). Drizzle has no helper for
        // comparing two columns at once, so it's a sql template. The ${...} values
        // become query parameters, never pasted-in text, so this is safe from SQL
        // injection. The casts tell Postgres the types of the two parameters.
        conditions.push(
          sql`(${events.startsAt}, ${events.id}) > (${position.startsAt.toISOString()}::timestamptz, ${position.id}::uuid)`,
        );
      }

      const rows = await db
        // Only the event's columns, so each row is a plain EventRow (a bare select()
        // after a join returns { events, venues } objects instead).
        .select(getTableColumns(events))
        .from(events)
        // The join is for the city filter: city lives on venues.
        .innerJoin(venues, eq(events.venueId, venues.id))
        // and() skips undefined, and and() with nothing in it means "no filter".
        .where(and(...conditions))
        // id breaks ties between events that start at the same time, so every event
        // has exactly one position. Must match the cursor's (startsAt, id).
        .orderBy(asc(events.startsAt), asc(events.id))
        // One extra row: if it comes back, there's another page after this one.
        .limit(first + 1);

      const hasNextPage = rows.length > first;
      const page = hasNextPage ? rows.slice(0, first) : rows;
      const edges = page.map((row) => ({
        cursor: encodeCursor(row),
        node: row,
      }));

      return {
        edges,
        pageInfo: { hasNextPage, endCursor: edges.at(-1)?.cursor ?? null },
      };
    },

    cities: async (_parent, _args, { db }) => {
      // Can return cities without events, but the UI will handle this case.
      const rows = await db
        .selectDistinct({
          city: venues.city,
        })
        .from(venues)
        .orderBy(asc(venues.city));

      return rows.map((row) => row.city);
    },
  },

  Mutation: {
    signUp: async (_parent, { email, password }, { db, redis, res }) => {
      const cleanEmail = normalizeEmail(email);
      if (!/^[^\s@]+@[^\s@]+$/.test(cleanEmail) || cleanEmail.length > 254) {
        throw new GraphQLError("Enter a valid email address.", {
          extensions: { code: "BAD_USER_INPUT", argumentName: "email" },
        });
      }

      const passwordValidationError = newPasswordProblem(password, {
        email: cleanEmail,
      });
      if (passwordValidationError) {
        throw new GraphQLError(passwordValidationError, {
          extensions: { code: "BAD_USER_INPUT", argumentName: "password" },
        });
      }

      const passwordHash = await hashPassword(password);

      let user: CurrentUser;
      try {
        const userRows = await db
          .insert(users)
          .values({
            email: cleanEmail,
            passwordHash,
          })
          .returning({ id: users.id, email: users.email });

        if (!userRows[0]) throw new Error("Insert returned no row");

        user = userRows[0];
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw new GraphQLError("An account with that email already exists.", {
            extensions: { code: "BAD_USER_INPUT", argumentName: "email" },
          });
        }
        throw err; // anything else is a real failure: let it surface as a server error
      }

      // Signing up signs you in: start a session and send its cookie.
      const sessionId = await createSession(redis, user.id);
      setSessionCookie(res, sessionId);

      return user;
    },
    signIn: async (_parent, { email, password }, { db, redis, res, sessionId }) => {
      const cleanEmail = normalizeEmail(email);

      const [found] = await db
        .select({ id: users.id, email: users.email, passwordHash: users.passwordHash })
        .from(users)
        .where(eq(sql`lower(${users.email})`, cleanEmail))
        .limit(1);

      const ok = await verifyPassword(found?.passwordHash ?? null, password);
      if (!found || !ok) {
        throw new GraphQLError('Incorrect email or password.', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      if (sessionId) await destroySession(redis, sessionId);

      const newSessionId = await createSession(redis, found.id);
      setSessionCookie(res, newSessionId);

      return { id: found.id, email: found.email };
    },
    signOut: async (_parent, _args, { res, redis, sessionId }) => {
      if (sessionId) await destroySession(redis, sessionId);
      clearSessionCookie(res);
      return true;
    },

    // The transaction and its locks live in db/holds.ts. This checks the request,
    // then turns the outcome into the GraphQL result or an error.
    holdSeats: async (_parent, { eventId, seatIds }, context) => {
      const user = requireUser(context); // UNAUTHENTICATED when signed out
      const badInput = (message: string, argumentName: string) =>
        new GraphQLError(message, { extensions: { code: "BAD_USER_INPUT", argumentName } });

      const ids = [...new Set(seatIds)]; // the same seat twice is still one seat
      // Postgres rejects a malformed uuid with an error that would surface as a server
      // error, so check the format here and report it as bad input instead.
      if (!UUID.test(eventId)) throw badInput("That event doesn't exist.", "eventId");
      if (ids.length === 0 || ids.length > MAX_SEATS_PER_HOLD) {
        throw badInput(`Choose between 1 and ${MAX_SEATS_PER_HOLD} seats.`, "seatIds");
      }
      if (!ids.every((id) => UUID.test(id))) throw badInput("Some of those seats don't exist.", "seatIds");

      const outcome = await holdSeats(context.db, { userId: user.id, eventId, seatIds: ids });
      switch (outcome.kind) {
        case "held":
          return {
            id: outcome.holdId,
            expiresAt: outcome.expiresAt,
            seats: await selectEventSeats(context.db, inArray(eventSeats.id, outcome.seatIds)),
          };
        case "unavailable":
          // Read after the transaction, so each seat shows why it's taken (sold or held).
          return { seats: await selectEventSeats(context.db, inArray(eventSeats.id, outcome.seatIds)) };
        case "event_not_found":
          throw badInput("That event doesn't exist.", "eventId");
        case "event_not_on_sale":
          throw badInput("Tickets for this event aren't on sale.", "eventId");
        case "unknown_seats":
          throw badInput("Some of those seats aren't part of this event.", "seatIds");
        case "already_holding":
          throw new GraphQLError(
            "You already have seats held for this event. Release them to choose different ones.",
            { extensions: { code: "HOLD_EXISTS" } },
          );
      }
    },
  },

  // Tells Apollo which member of the union a result is: only a Hold has expiresAt.
  HoldSeatsResult: {
    __resolveType: (result) => ("expiresAt" in result ? "Hold" : "SeatsUnavailable"),
  },

  Event: {
    // Batched: every event on the page asks the same per-request loader, which makes
    // one `where id in (...)` query. A missing venue rejects the load with
    // "Venue <id> not found" (see loaders.ts), so there's no null to check for here.
    venue: (parent, _args, { loaders }) =>
      loaders.venueById.load(parent.venueId),
    // Batched the same way: one availability query for every event on the page.
    availability: (parent, _args, { loaders }) =>
      loaders.availabilityByEventId.load(parent.id),
    seats: (parent, _args, { db }) => selectEventSeats(db, eq(eventSeats.eventId, parent.id)),
  },
};
