#!/usr/bin/env node
const postgres = require('postgres');

async function testAndMigrate() {
  const sql = postgres(process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
  
  try {
    console.log('🔍 Checking if app schema exists...');
    
    // Create app schema if it doesn't exist
    await sql`CREATE SCHEMA IF NOT EXISTS app`;
    console.log('✅ App schema ready');
    
    // Check if consultations table exists
    const result = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'app' 
        AND table_name = 'consultations'
      );
    `;
    
    console.log('📊 Consultations table exists:', result[0].exists);
    
    if (!result[0].exists) {
      console.log('🔄 Creating consultations table...');
      
      // Create the consultations table directly
      await sql`
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
      `;
      
      console.log('✅ Consultations table created!');
    }
    
    // List all tables in app schema
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'app'
      ORDER BY table_name;
    `;
    
    console.log('📋 Tables in app schema:', tables.map(t => t.table_name));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

testAndMigrate();