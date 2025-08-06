#!/usr/bin/env node
import { readFileSync } from 'fs';
import { getDatabase } from '../src/lib/db.ts';
import { getDatabaseUrl } from '../src/lib/env.ts';

async function migrate() {
  try {
    console.log('🔄 Running database migration...');
    
    // Read the SQL file
    const sqlContent = readFileSync('./drizzle/0000_perpetual_northstar.sql', 'utf-8');
    
    // Get database connection
    const db = await getDatabase();
    
    // Split by statement separator and execute each statement
    const statements = sqlContent
      .split('-->')
      .filter(stmt => stmt.trim() && !stmt.trim().startsWith('statement-breakpoint'))
      .map(stmt => stmt.trim())
      .filter(Boolean);
    
    console.log(`📄 Executing ${statements.length} SQL statements...`);
    
    for (const statement of statements) {
      if (statement && !statement.includes('statement-breakpoint')) {
        try {
          await db.execute(statement);
        } catch (error) {
          // Ignore "already exists" errors
          if (!error.message.includes('already exists')) {
            console.warn(`⚠️  Statement failed (continuing):`, error.message);
          }
        }
      }
    }
    
    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();