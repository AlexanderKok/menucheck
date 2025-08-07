CREATE TABLE IF NOT EXISTS "app"."restaurant_menu_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"restaurant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"url" text NOT NULL,
	"source_type" text NOT NULL,
	"document_type" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"last_attempted_at" timestamp,
	"successfully_parsed_at" timestamp,
	"parse_method" text,
	"confidence" numeric(5, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."restaurants" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"address" text,
	"city" text,
	"country" text,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"restaurant_type" text,
	"cuisines" jsonb,
	"phone_number" text,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."menu_uploads" ALTER COLUMN "file_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."menu_uploads" ALTER COLUMN "original_file_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."menu_uploads" ALTER COLUMN "file_size" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."menu_uploads" ALTER COLUMN "mime_type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."menu_uploads" ALTER COLUMN "file_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."menu_items" ADD COLUMN "prominence" jsonb;--> statement-breakpoint
ALTER TABLE "app"."menu_uploads" ADD COLUMN "restaurant_id" text;--> statement-breakpoint
ALTER TABLE "app"."menu_uploads" ADD COLUMN "source_url" text;--> statement-breakpoint
ALTER TABLE "app"."menu_uploads" ADD COLUMN "parse_method" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."menu_uploads" ADD CONSTRAINT "menu_uploads_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "app"."restaurants"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."restaurant_menu_sources" ADD CONSTRAINT "restaurant_menu_sources_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "app"."restaurants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."restaurant_menu_sources" ADD CONSTRAINT "restaurant_menu_sources_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
