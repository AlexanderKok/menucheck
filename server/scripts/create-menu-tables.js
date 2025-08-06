#!/usr/bin/env node
const postgres = require('postgres');

async function createMenuTables() {
  const sql = postgres(process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
  
  try {
    console.log('🔄 Creating menu tables...');
    
    // Create menu_uploads table
    await sql`
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
    `;
    
    // Create menu_categories table
    await sql`
      CREATE TABLE IF NOT EXISTS "app"."menu_categories" (
        "id" text PRIMARY KEY NOT NULL,
        "menu_id" text NOT NULL,
        "name" text NOT NULL,
        "item_count" integer DEFAULT 0 NOT NULL,
        "avg_price" numeric(10, 2),
        "position" integer,
        "created_at" timestamp DEFAULT now() NOT NULL
      );
    `;
    
    // Create menu_items table
    await sql`
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
    `;
    
    // Create menu_recommendations table
    await sql`
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
    `;
    
    console.log('✅ All menu tables created successfully!');
    
    // List all tables
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'app'
      ORDER BY table_name;
    `;
    
    console.log('📋 All tables in app schema:', tables.map(t => t.table_name));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

createMenuTables();