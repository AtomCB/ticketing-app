ALTER TABLE "venues" RENAME COLUMN "last_updated" TO "updated_at";--> statement-breakpoint
ALTER TABLE "event_seats" DROP CONSTRAINT "event_seats_seat_id_seats_id_fk";
--> statement-breakpoint
ALTER TABLE "event_seats" ADD CONSTRAINT "event_seats_seat_id_seats_id_fk" FOREIGN KEY ("seat_id") REFERENCES "public"."seats"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "seats_section_row_number_uq" ON "seats" USING btree ("section_id","row_label","seat_number");--> statement-breakpoint
CREATE UNIQUE INDEX "sections_venue_name_uq" ON "sections" USING btree ("venue_id","name");