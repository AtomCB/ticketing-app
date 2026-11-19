CREATE TABLE "holds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "holds_expires_after_created" CHECK ("holds"."expires_at" > "holds"."created_at")
);
--> statement-breakpoint
ALTER TABLE "event_seats" ADD COLUMN "hold_id" uuid;--> statement-breakpoint
ALTER TABLE "holds" ADD CONSTRAINT "holds_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holds" ADD CONSTRAINT "holds_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "holds_user_event_idx" ON "holds" USING btree ("user_id","event_id");--> statement-breakpoint
ALTER TABLE "event_seats" ADD CONSTRAINT "event_seats_hold_id_holds_id_fk" FOREIGN KEY ("hold_id") REFERENCES "public"."holds"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_seats_hold_id_idx" ON "event_seats" USING btree ("hold_id");