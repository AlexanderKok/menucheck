CREATE TABLE IF NOT EXISTS "app"."public_restaurant_details" (
	"id" text PRIMARY KEY NOT NULL,
	"public_upload_id" text NOT NULL,
	"restaurant_name" text NOT NULL,
	"address" text,
	"city" text,
	"country" text,
	"restaurant_type" text,
	"cuisines" text,
	"phone_number" text,
	"description" text,
	"report_requested" boolean DEFAULT false,
	"report_requested_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."public_uploads" (
	"id" text PRIMARY KEY NOT NULL,
	"ip_address" text NOT NULL,
	"upload_type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"menu_upload_id" text,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."rate_limit_tracker" (
	"id" text PRIMARY KEY NOT NULL,
	"ip_address" text NOT NULL,
	"request_count" integer DEFAULT 1 NOT NULL,
	"window_start" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."menu_uploads" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."menu_uploads" ADD COLUMN "ip_address" text;--> statement-breakpoint
ALTER TABLE "app"."menu_uploads" ADD COLUMN "expires_at" timestamp;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."public_restaurant_details" ADD CONSTRAINT "public_restaurant_details_public_upload_id_public_uploads_id_fk" FOREIGN KEY ("public_upload_id") REFERENCES "app"."public_uploads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."public_uploads" ADD CONSTRAINT "public_uploads_menu_upload_id_menu_uploads_id_fk" FOREIGN KEY ("menu_upload_id") REFERENCES "app"."menu_uploads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
