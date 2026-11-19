ALTER TABLE "event_seats" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "event_seats" ALTER COLUMN "status" SET DEFAULT 'available'::text;--> statement-breakpoint
DROP TYPE "public"."seat_status";--> statement-breakpoint
CREATE TYPE "public"."seat_status" AS ENUM('available', 'sold');--> statement-breakpoint
ALTER TABLE "event_seats" ALTER COLUMN "status" SET DEFAULT 'available'::"public"."seat_status";--> statement-breakpoint
ALTER TABLE "event_seats" ALTER COLUMN "status" SET DATA TYPE "public"."seat_status" USING "status"::"public"."seat_status";--> statement-breakpoint
DROP INDEX "event_seats_hold_id_idx";--> statement-breakpoint
CREATE INDEX "event_seats_hold_id_idx" ON "event_seats" USING btree ("hold_id") WHERE "event_seats"."hold_id" is not null;