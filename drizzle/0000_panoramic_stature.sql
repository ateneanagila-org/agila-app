CREATE TYPE "public"."auth_role" AS ENUM('Administrator', 'Manager', 'Volunteer');--> statement-breakpoint
CREATE TYPE "public"."urgency" AS ENUM('Now', 'Within the hour', 'Within the day', 'Within the week', 'Indefinite');--> statement-breakpoint
CREATE TABLE "requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"fee" integer,
	"title" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"urgency" "urgency" DEFAULT 'Now' NOT NULL,
	"type" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text,
	"auth_role" "auth_role" DEFAULT 'Volunteer' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;