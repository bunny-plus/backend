CREATE TABLE "cards" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"rarity" text NOT NULL,
	"attack" integer NOT NULL,
	"defense" integer NOT NULL,
	"description" text NOT NULL,
	"image_url" text
);
--> statement-breakpoint
CREATE TABLE "user_cards" (
	"id" serial PRIMARY KEY NOT NULL,
	"discord_id" text NOT NULL,
	"card_id" integer NOT NULL,
	"acquired_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"discord_id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"avatar" text,
	"currency" integer DEFAULT 10 NOT NULL,
	"onboarding" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_cards" ADD CONSTRAINT "user_cards_discord_id_users_discord_id_fk" FOREIGN KEY ("discord_id") REFERENCES "public"."users"("discord_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_cards" ADD CONSTRAINT "user_cards_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_discord_id_users_discord_id_fk" FOREIGN KEY ("discord_id") REFERENCES "public"."users"("discord_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" DROP COLUMN "username";