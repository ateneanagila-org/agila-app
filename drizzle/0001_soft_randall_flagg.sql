CREATE TYPE "public"."cat_age" AS ENUM('Neonatal', 'Kitten', 'Juvenile', 'Adult', 'Unknown');--> statement-breakpoint
CREATE TYPE "public"."cat_color" AS ENUM('Black', 'White', 'Black and White', 'Calico', 'Tortie', 'Torbie', 'Orange Tabby', 'Orange and White Tabby', 'Gray Tabby', 'Gray and White Tabby', 'Brown Tabby', 'Brown and White Tabby', 'Unknown');--> statement-breakpoint
CREATE TYPE "public"."cat_entry_status" AS ENUM('Unsubmitted', 'Unreviewed', 'Merged', 'Original');--> statement-breakpoint
CREATE TYPE "public"."cathealthrecord_status" AS ENUM('Healthy', 'Sick', 'Injured', 'Sick and Injured');--> statement-breakpoint
CREATE TYPE "public"."cat_sex" AS ENUM('Female', 'Male', 'Unknown');--> statement-breakpoint
CREATE TYPE "public"."cat_sociability" AS ENUM('Domesticated', 'Tame', 'Feral', 'Unknown');--> statement-breakpoint
CREATE TYPE "public"."cat_status" AS ENUM('Deceased', 'Fostered', 'Adopted', 'Stray', 'Missing');--> statement-breakpoint
CREATE TYPE "public"."intervention_status" AS ENUM('Pending', 'Finished', 'Cancelled');--> statement-breakpoint
CREATE TYPE "public"."intervention_type" AS ENUM('TNVR', 'Veterinarian');--> statement-breakpoint
CREATE TYPE "public"."region_name" AS ENUM('GATE 3', 'ARETE', 'SDC', 'ISO', 'BEL', 'LEONG', 'FAURA', 'MVP', 'SCHMIITT', 'GONZ', 'XAVIER', 'SEC', 'CTC/SOM', 'JSEC', 'PIPAC', 'CERVINI', 'UNI DORM', 'EBAIS', 'POLLOCK', 'COV COURTS', 'LST', 'GATE 5', 'ASHS', 'AJHS', 'GATE 2', 'GATE 1', 'BEG', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."region_status" AS ENUM('Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple', 'Gray', 'Brown');--> statement-breakpoint
CREATE TABLE "allowed_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text,
	"allower_id" uuid,
	"allowed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cat_health_record" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cat_id" uuid NOT NULL,
	"last_updated_at" timestamp,
	"condition" "cathealthrecord_status",
	"neuter_date" timestamp,
	"vaccination_date" timestamp
);
--> statement-breakpoint
CREATE TABLE "cats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merged_into_id" uuid,
	"last_updated_at" timestamp,
	"entry_status" "cat_entry_status" DEFAULT 'Unreviewed' NOT NULL,
	"photo_url" text,
	"color" "cat_color" DEFAULT 'Unknown',
	"age" "cat_age" DEFAULT 'Unknown',
	"sex" "cat_sex" DEFAULT 'Unknown',
	"name" text,
	"sociability" "cat_sociability" DEFAULT 'Unknown',
	"cat_status" "cat_status",
	"spot_last_seen" text,
	"caretaker" text,
	"notes" text,
	"is_adoptable" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "interventions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cat_id" uuid NOT NULL,
	"last_updated_at" timestamp,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"type" "intervention_type",
	"status" "intervention_status" DEFAULT 'Pending',
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "regions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" "region_name" DEFAULT 'UNKNOWN' NOT NULL,
	"status" "region_status"
);
--> statement-breakpoint
CREATE TABLE "session_cats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cat_id" uuid NOT NULL,
	"session_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"region_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_updated_at" timestamp,
	"is_finished" boolean DEFAULT false
);
--> statement-breakpoint
ALTER TABLE "allowed_emails" ADD CONSTRAINT "allowed_emails_allower_id_users_id_fk" FOREIGN KEY ("allower_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cat_health_record" ADD CONSTRAINT "cat_health_record_cat_id_cats_id_fk" FOREIGN KEY ("cat_id") REFERENCES "public"."cats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cats" ADD CONSTRAINT "cats_merged_into_id_cats_id_fk" FOREIGN KEY ("merged_into_id") REFERENCES "public"."cats"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_cat_id_cats_id_fk" FOREIGN KEY ("cat_id") REFERENCES "public"."cats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_cats" ADD CONSTRAINT "session_cats_cat_id_cats_id_fk" FOREIGN KEY ("cat_id") REFERENCES "public"."cats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_cats" ADD CONSTRAINT "session_cats_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_users" ADD CONSTRAINT "session_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_users" ADD CONSTRAINT "session_users_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE cascade ON UPDATE no action;