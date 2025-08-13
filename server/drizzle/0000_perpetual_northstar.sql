CREATE SCHEMA "app";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."consultation_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"consultation_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"file_name" text NOT NULL,
	"file_url" text NOT NULL,
	"file_size" text,
	"mime_type" text,
	"status" text DEFAULT 'draft',
	"version" text DEFAULT '1.0',
	"sent_at" timestamp,
	"viewed_at" timestamp,
	"signed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."consultation_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"consultation_id" text NOT NULL,
	"type" text NOT NULL,
	"direction" text NOT NULL,
	"subject" text,
	"content" text NOT NULL,
	"sender_name" text,
	"sender_email" text,
	"recipient_name" text,
	"recipient_email" text,
	"message_date" timestamp NOT NULL,
	"is_read" boolean DEFAULT false,
	"attachments" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."consultations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"restaurant_name" text NOT NULL,
	"cuisine_type" text NOT NULL,
	"location" text NOT NULL,
	"established_year" text,
	"contact_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"seating_capacity" text NOT NULL,
	"service_types" jsonb NOT NULL,
	"price_range" text NOT NULL,
	"current_challenges" jsonb,
	"primary_goals" jsonb NOT NULL,
	"timeframe" text NOT NULL,
	"budget" text NOT NULL,
	"additional_notes" text,
	"marketing_consent" boolean DEFAULT false,
	"terms_accepted" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"assigned_consultant" text,
	"scheduled_date" timestamp,
	"internal_notes" text,
	"priority" text DEFAULT 'medium',
	"source" text DEFAULT 'website',
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_contacted_at" timestamp,
	"next_follow_up_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."menu_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"menu_id" text NOT NULL,
	"name" text NOT NULL,
	"item_count" integer DEFAULT 0 NOT NULL,
	"avg_price" numeric(10, 2),
	"position" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."menu_items" (
	"id" text PRIMARY KEY NOT NULL,
	"menu_id" text NOT NULL,
	"category_id" text,
	"name" text NOT NULL,
	"description" text,
	"price" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"position" integer,
	"is_highlighted" boolean DEFAULT false,
	"estimated_cost" numeric(10, 2),
	"profit_margin" numeric(5, 2),
	"popularity_score" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."menu_recommendations" (
	"id" text PRIMARY KEY NOT NULL,
	"menu_id" text NOT NULL,
	"type" text NOT NULL,
	"priority" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"impact" text,
	"item_id" text,
	"category_id" text,
	"is_implemented" boolean DEFAULT false,
	"implemented_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."menu_uploads" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"file_name" text NOT NULL,
	"original_file_name" text NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" text NOT NULL,
	"file_url" text NOT NULL,
	"status" text DEFAULT 'uploading' NOT NULL,
	"analysis_data" jsonb,
	"total_items" integer,
	"avg_price" numeric(10, 2),
	"min_price" numeric(10, 2),
	"max_price" numeric(10, 2),
	"profitability_score" integer,
	"readability_score" integer,
	"pricing_optimization_score" integer,
	"category_balance_score" integer,
	"processing_started_at" timestamp,
	"processing_completed_at" timestamp,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"photo_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."consultation_documents" ADD CONSTRAINT "consultation_documents_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "app"."consultations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."consultation_messages" ADD CONSTRAINT "consultation_messages_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "app"."consultations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."consultations" ADD CONSTRAINT "consultations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."menu_categories" ADD CONSTRAINT "menu_categories_menu_id_menu_uploads_id_fk" FOREIGN KEY ("menu_id") REFERENCES "app"."menu_uploads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."menu_items" ADD CONSTRAINT "menu_items_menu_id_menu_uploads_id_fk" FOREIGN KEY ("menu_id") REFERENCES "app"."menu_uploads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."menu_items" ADD CONSTRAINT "menu_items_category_id_menu_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "app"."menu_categories"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."menu_recommendations" ADD CONSTRAINT "menu_recommendations_menu_id_menu_uploads_id_fk" FOREIGN KEY ("menu_id") REFERENCES "app"."menu_uploads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."menu_recommendations" ADD CONSTRAINT "menu_recommendations_item_id_menu_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "app"."menu_items"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."menu_recommendations" ADD CONSTRAINT "menu_recommendations_category_id_menu_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "app"."menu_categories"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."menu_uploads" ADD CONSTRAINT "menu_uploads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
-- Ensure menu_uploads.document_id exists and is linked to documents
ALTER TABLE "app"."menu_uploads" ADD COLUMN IF NOT EXISTS "document_id" text;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."menu_uploads" ADD CONSTRAINT "menu_uploads_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "app"."documents"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
-- Unified documents and processing lineage tables
CREATE TABLE IF NOT EXISTS "app"."documents" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text REFERENCES "app"."users"("id") ON DELETE cascade,
  "original_name" text,
  "mime_type" text,
  "file_size" integer,
  "storage_path" text,
  "source_type" text,
  "source_url" text,
  "document_type" text,
  "status" text DEFAULT 'uploaded' NOT NULL,
  "status_reason" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_documents_user_id" ON "app"."documents" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_documents_status" ON "app"."documents" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_documents_source_type" ON "app"."documents" ("source_type");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."parse_runs" (
  "id" text PRIMARY KEY NOT NULL,
  "document_id" text NOT NULL REFERENCES "app"."documents"("id") ON DELETE cascade,
  "parser_version" text NOT NULL,
  "parse_method" text NOT NULL,
  "status" text NOT NULL,
  "confidence" integer,
  "raw_output" jsonb,
  "metadata" jsonb,
  "error_message" text,
  "started_at" timestamp DEFAULT now(),
  "completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."analysis_runs" (
  "id" text PRIMARY KEY NOT NULL,
  "parse_run_id" text NOT NULL REFERENCES "app"."parse_runs"("id") ON DELETE cascade,
  "analysis_version" text NOT NULL,
  "status" text NOT NULL,
  "analysis_results" jsonb,
  "metrics" jsonb,
  "error_message" text,
  "started_at" timestamp DEFAULT now(),
  "completed_at" timestamp
);
