#!/usr/bin/env node
const { readFileSync } = require('fs');
const postgres = require('postgres');

async function migrate() {
  const sql = postgres(process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres');
  
  try {
    console.log('🔄 Running database migration...');
    
    // Read and execute the SQL file
    const sqlContent = readFileSync('./drizzle/0000_perpetual_northstar.sql', 'utf-8');
    
    // Clean up the SQL content
    const cleanSQL = sqlContent
      .replace(/-->\s*statement-breakpoint/g, '')
      .replace(/-->/g, '')
      .trim();
    
    console.log('📄 Executing migration SQL...');
    await sql.unsafe(cleanSQL);
    
    console.log('✅ Migration completed successfully!');
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('✅ Tables already exist, migration complete!');
    } else {
      console.error('❌ Migration failed:', error.message);
      process.exit(1);
    }
  } finally {
    await sql.end();
  }
}

migrate();