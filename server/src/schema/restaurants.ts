import { pgTable, text, timestamp, decimal, jsonb } from 'drizzle-orm/pg-core';
import { appSchema } from './users';
import { users } from './users';

export const restaurants = appSchema.table('restaurants', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  url: text('url').notNull(),
  
  // Location information
  address: text('address'),
  city: text('city'),
  country: text('country'),
  latitude: decimal('latitude', { precision: 10, scale: 7 }),
  longitude: decimal('longitude', { precision: 10, scale: 7 }),
  
  // Restaurant details
  restaurantType: text('restaurant_type'), // Casual dining, Fine dining, Fast casual, QSR, Café, etc.
  cuisines: jsonb('cuisines').$type<string[]>(), // Array of cuisine types
  phoneNumber: text('phone_number'),
  description: text('description'),
  
  // Metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const restaurantMenuSources = appSchema.table('restaurant_menu_sources', {
  id: text('id').primaryKey(),
  restaurantId: text('restaurant_id').notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  // Source information
  url: text('url').notNull(),
  sourceType: text('source_type').notNull(), // pdf, html, js
  documentType: text('document_type'), // digital_pdf, scanned_pdf, html_static, html_dynamic
  
  // Processing status
  status: text('status').notNull().default('pending'), // pending, processing, completed, failed
  errorMessage: text('error_message'),
  
  // Processing metadata
  lastAttemptedAt: timestamp('last_attempted_at'),
  successfullyParsedAt: timestamp('successfully_parsed_at'),
  parseMethod: text('parse_method'), // which parsing strategy was used
  confidence: decimal('confidence', { precision: 5, scale: 2 }), // parsing confidence score 0-100
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type Restaurant = typeof restaurants.$inferSelect;
export type NewRestaurant = typeof restaurants.$inferInsert;

export type RestaurantMenuSource = typeof restaurantMenuSources.$inferSelect;
export type NewRestaurantMenuSource = typeof restaurantMenuSources.$inferInsert;