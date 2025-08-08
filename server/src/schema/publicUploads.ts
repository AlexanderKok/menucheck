import { pgTable, text, timestamp, integer, boolean } from 'drizzle-orm/pg-core';
import { appSchema } from './users';
import { menuUploads } from './menus';

// Table for tracking public uploads without user accounts
export const publicUploads = appSchema.table('public_uploads', {
  id: text('id').primaryKey(),
  ipAddress: text('ip_address').notNull(), // For rate limiting
  uploadType: text('upload_type').notNull(), // 'pdf' | 'url'
  status: text('status').notNull().default('pending'), // pending, processing, completed, failed
  menuUploadId: text('menu_upload_id').references(() => menuUploads.id, { onDelete: 'cascade' }),
  
  // Security and cleanup
  expiresAt: timestamp('expires_at').notNull(), // For automatic cleanup
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Table for IP-based rate limiting
export const rateLimitTracker = appSchema.table('rate_limit_tracker', {
  id: text('id').primaryKey(),
  ipAddress: text('ip_address').notNull(),
  requestCount: integer('request_count').notNull().default(1),
  windowStart: timestamp('window_start').notNull(), // Start of current hour window
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Table for tracking restaurant details collected after upload
export const publicRestaurantDetails = appSchema.table('public_restaurant_details', {
  id: text('id').primaryKey(),
  publicUploadId: text('public_upload_id').notNull().references(() => publicUploads.id, { onDelete: 'cascade' }),
  
  // Restaurant information
  restaurantName: text('restaurant_name').notNull(),
  address: text('address'),
  city: text('city'),
  country: text('country'),
  restaurantType: text('restaurant_type'),
  cuisines: text('cuisines'), // JSON string array
  phoneNumber: text('phone_number'),
  description: text('description'),
  
  // Report generation status
  reportRequested: boolean('report_requested').default(false),
  reportRequestedAt: timestamp('report_requested_at'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type PublicUpload = typeof publicUploads.$inferSelect;
export type NewPublicUpload = typeof publicUploads.$inferInsert;

export type RateLimitTracker = typeof rateLimitTracker.$inferSelect;
export type NewRateLimitTracker = typeof rateLimitTracker.$inferInsert;

export type PublicRestaurantDetails = typeof publicRestaurantDetails.$inferSelect;
export type NewPublicRestaurantDetails = typeof publicRestaurantDetails.$inferInsert;