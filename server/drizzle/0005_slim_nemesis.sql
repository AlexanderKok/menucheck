CREATE TABLE IF NOT EXISTS "app"."analysis_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"parse_run_id" text NOT NULL,
	"analysis_version" text NOT NULL,
	"status" text NOT NULL,
	"analysis_results" jsonb,
	"metrics" jsonb,
	"error_message" text,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."documents" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
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
CREATE TABLE IF NOT EXISTS "app"."parse_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
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
DO $$ BEGIN
 ALTER TABLE "app"."analysis_runs" ADD CONSTRAINT "analysis_runs_parse_run_id_parse_runs_id_fk" FOREIGN KEY ("parse_run_id") REFERENCES "app"."parse_runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."documents" ADD CONSTRAINT "documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."parse_runs" ADD CONSTRAINT "parse_runs_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "app"."documents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
