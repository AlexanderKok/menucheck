CREATE TABLE IF NOT EXISTS "app"."ext_crawl_runs" (
  "id" text PRIMARY KEY NOT NULL,
  "location_query" text NOT NULL,
  "provider" text NOT NULL,
  "area_id" text,
  "bbox" jsonb,
  "started_at" timestamp DEFAULT now(),
  "completed_at" timestamp,
  "status" text NOT NULL DEFAULT 'pending',
  "stats" jsonb,
  "error_message" text
);

CREATE TABLE IF NOT EXISTS "app"."ext_restaurants" (
  "id" text PRIMARY KEY NOT NULL,
  "run_id" text NOT NULL,
  "source" text NOT NULL,
  "source_element_type" text NOT NULL,
  "source_element_id" text NOT NULL,
  "name" text NOT NULL,
  "addr_street" text,
  "addr_housenumber" text,
  "addr_postcode" text,
  "addr_city" text,
  "addr_country" text,
  "latitude" numeric(10,7),
  "longitude" numeric(10,7),
  "phone" text,
  "osm_tags" jsonb,
  "website_url" text,
  "website_discovery_method" text,
  "website_effective_url" text,
  "website_http_status" integer,
  "website_content_type" text,
  "website_is_social" boolean DEFAULT false NOT NULL,
  "website_is_valid" boolean DEFAULT false NOT NULL,
  "website_last_checked_at" timestamp,
  "menu_url" text,
  "menu_discovery_method" text,
  "menu_http_status" integer,
  "menu_content_type" text,
  "menu_is_pdf" boolean DEFAULT false NOT NULL,
  "menu_is_valid" boolean DEFAULT false NOT NULL,
  "menu_last_checked_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "app"."ext_restaurant_checks" (
  "id" text PRIMARY KEY NOT NULL,
  "restaurant_id" text NOT NULL,
  "target" text NOT NULL,
  "candidate_url" text NOT NULL,
  "method" text NOT NULL,
  "http_status" integer,
  "content_type" text,
  "effective_url" text,
  "is_valid" boolean NOT NULL,
  "error_message" text,
  "checked_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "app"."ext_restaurants" ADD CONSTRAINT "ext_restaurants_run_id_ext_crawl_runs_id_fk"
  FOREIGN KEY ("run_id") REFERENCES "app"."ext_crawl_runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "app"."ext_restaurant_checks" ADD CONSTRAINT "ext_restaurant_checks_restaurant_id_ext_restaurants_id_fk"
  FOREIGN KEY ("restaurant_id") REFERENCES "app"."ext_restaurants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;



