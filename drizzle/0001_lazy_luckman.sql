CREATE TYPE "public"."urgency" AS ENUM('Now', 'Within the hour', 'Within the day', 'Within the week', 'Indefinite');--> statement-breakpoint
ALTER TABLE "messages" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "post_bids" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "posts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "request_bids" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "reviews" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "messages" CASCADE;--> statement-breakpoint
DROP TABLE "post_bids" CASCADE;--> statement-breakpoint
DROP TABLE "posts" CASCADE;--> statement-breakpoint
DROP TABLE "request_bids" CASCADE;--> statement-breakpoint
DROP TABLE "reviews" CASCADE;--> statement-breakpoint
ALTER TABLE "requests" ALTER COLUMN "urgency" SET DEFAULT 'Now'::"public"."urgency";--> statement-breakpoint
ALTER TABLE "requests" ALTER COLUMN "urgency" SET DATA TYPE "public"."urgency" USING "urgency"::"public"."urgency";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "auth_role" text;--> statement-breakpoint
ALTER TABLE "requests" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "id_number";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "phone_number";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "contributions";