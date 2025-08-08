import { pgTable, text, timestamp, integer, jsonb, boolean, decimal } from 'drizzle-orm/pg-core';
import { appSchema, users } from './users';
import { restaurants } from './restaurants';

export const menuUploads = appSchema.table('menu_uploads', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }), // Allow null for public uploads
  restaurantId: text('restaurant_id').references(() => restaurants.id, { onDelete: 'set null' }),
  ipAddress: text('ip_address'), // For public upload tracking
  expiresAt: timestamp('expires_at'), // For public upload cleanup
  fileName: text('file_name'),
  originalFileName: text('original_file_name'),
  fileSize: integer('file_size'), // in bytes
  mimeType: text('mime_type'),
  fileUrl: text('file_url'), // URL to stored file or original source URL
  sourceUrl: text('source_url'), // Original URL for URL-based uploads
  parseMethod: text('parse_method'), // html, pdf_digital, pdf_ocr, javascript
  status: text('status').notNull().default('uploading'), // uploading, processing, completed, failed
  
  // Analysis results
  analysisData: jsonb('analysis_data'), // JSON containing full analysis results
  totalItems: integer('total_items'),
  avgPrice: decimal('avg_price', { precision: 10, scale: 2 }),
  minPrice: decimal('min_price', { precision: 10, scale: 2 }),
  maxPrice: decimal('max_price', { precision: 10, scale: 2 }),
  
  // Metrics scores (0-100)
  profitabilityScore: integer('profitability_score'),
  readabilityScore: integer('readability_score'),
  pricingOptimizationScore: integer('pricing_optimization_score'),
  categoryBalanceScore: integer('category_balance_score'),
  
  // Processing info
  processingStartedAt: timestamp('processing_started_at'),
  processingCompletedAt: timestamp('processing_completed_at'),
  errorMessage: text('error_message'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const menuCategories = appSchema.table('menu_categories', {
  id: text('id').primaryKey(),
  menuId: text('menu_id').notNull().references(() => menuUploads.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  itemCount: integer('item_count').notNull().default(0),
  avgPrice: decimal('avg_price', { precision: 10, scale: 2 }),
  position: integer('position'), // order on menu
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const menuItems = appSchema.table('menu_items', {
  id: text('id').primaryKey(),
  menuId: text('menu_id').notNull().references(() => menuUploads.id, { onDelete: 'cascade' }),
  categoryId: text('category_id').references(() => menuCategories.id, { onDelete: 'set null' }),
  
  name: text('name').notNull(),
  description: text('description'),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  currency: text('currency').notNull().default('EUR'),
  
  // Position and layout
  position: integer('position'), // position within category
  isHighlighted: boolean('is_highlighted').default(false), // special emphasis on menu
  
  // Visual prominence indicators for URL-parsed menus
  prominence: jsonb('prominence').$type<{
    fontSize?: 'small' | 'medium' | 'large' | 'xlarge';
    hasSpecialIcon?: boolean;
    iconType?: 'chef_special' | 'customer_favorite' | 'new' | 'spicy' | 'vegetarian' | 'gluten_free' | string;
    hasVisualBox?: boolean;
    isHighlighted?: boolean;
    position?: { x: number; y: number };
    confidenceScore?: number; // 0-100 confidence in prominence detection
  }>(),
  
  // Analysis insights
  estimatedCost: decimal('estimated_cost', { precision: 10, scale: 2 }),
  profitMargin: decimal('profit_margin', { precision: 5, scale: 2 }), // percentage
  popularityScore: integer('popularity_score'), // 0-100 based on placement/design
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const menuRecommendations = appSchema.table('menu_recommendations', {
  id: text('id').primaryKey(),
  menuId: text('menu_id').notNull().references(() => menuUploads.id, { onDelete: 'cascade' }),
  
  type: text('type').notNull(), // pricing, placement, description, category
  priority: text('priority').notNull(), // high, medium, low
  title: text('title').notNull(),
  description: text('description').notNull(),
  impact: text('impact'), // estimated impact description
  
  // Optional specific item/category reference
  itemId: text('item_id').references(() => menuItems.id, { onDelete: 'cascade' }),
  categoryId: text('category_id').references(() => menuCategories.id, { onDelete: 'cascade' }),
  
  // Implementation tracking
  isImplemented: boolean('is_implemented').default(false),
  implementedAt: timestamp('implemented_at'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
});


export type MenuUpload = typeof menuUploads.$inferSelect;
export type NewMenuUpload = typeof menuUploads.$inferInsert;

export type MenuCategory = typeof menuCategories.$inferSelect;
export type NewMenuCategory = typeof menuCategories.$inferInsert;

export type MenuItem = typeof menuItems.$inferSelect;
export type NewMenuItem = typeof menuItems.$inferInsert;

export type MenuRecommendation = typeof menuRecommendations.$inferSelect;
export type NewMenuRecommendation = typeof menuRecommendations.$inferInsert;