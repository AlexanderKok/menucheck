import { pgTable, text, timestamp, integer, boolean, jsonb, decimal, bigint } from 'drizzle-orm/pg-core';
import { appSchema } from './users';

// ext_crawl_runs – one row per ingestion run
export const extCrawlRuns = appSchema.table('ext_crawl_runs', {
  id: text('id').primaryKey(),
  locationQuery: text('location_query').notNull(),
  provider: text('provider').notNull(),
  areaId: text('area_id'),
  bbox: jsonb('bbox'),
  startedAt: timestamp('started_at').defaultNow(),
  completedAt: timestamp('completed_at'),
  status: text('status').notNull().default('pending'),
  stats: jsonb('stats'),
  errorMessage: text('error_message'),
});

// ext_restaurants – external/competitive entities
export const extRestaurants = appSchema.table('ext_restaurants', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull().references(() => extCrawlRuns.id, { onDelete: 'cascade' }),
  source: text('source').notNull(), // "osm"
  sourceElementType: text('source_element_type').notNull(), // node|way|relation
  sourceElementId: text('source_element_id').notNull(), // store as text for safety
  name: text('name').notNull(),
  addrStreet: text('addr_street'),
  addrHousenumber: text('addr_housenumber'),
  addrPostcode: text('addr_postcode'),
  addrCity: text('addr_city'),
  addrCountry: text('addr_country'),
  latitude: decimal('latitude', { precision: 10, scale: 7 }),
  longitude: decimal('longitude', { precision: 10, scale: 7 }),
  phone: text('phone'),
  osmTags: jsonb('osm_tags'),

  websiteUrl: text('website_url'),
  websiteDiscoveryMethod: text('website_discovery_method'), // osm|google
  websiteEffectiveUrl: text('website_effective_url'),
  websiteHttpStatus: integer('website_http_status'),
  websiteContentType: text('website_content_type'),
  websiteIsSocial: boolean('website_is_social').default(false).notNull(),
  websiteIsValid: boolean('website_is_valid').default(false).notNull(),
  websiteLastCheckedAt: timestamp('website_last_checked_at'),

  menuUrl: text('menu_url'),
  menuDiscoveryMethod: text('menu_discovery_method'), // link_text|header|sitemap|search
  menuHttpStatus: integer('menu_http_status'),
  menuContentType: text('menu_content_type'),
  menuIsPdf: boolean('menu_is_pdf').default(false).notNull(),
  menuIsValid: boolean('menu_is_valid').default(false).notNull(),
  menuLastCheckedAt: timestamp('menu_last_checked_at'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ext_restaurant_checks – audit log of validation attempts
export const extRestaurantChecks = appSchema.table('ext_restaurant_checks', {
  id: text('id').primaryKey(),
  restaurantId: text('restaurant_id').notNull().references(() => extRestaurants.id, { onDelete: 'cascade' }),
  target: text('target').notNull(), // website|menu
  candidateUrl: text('candidate_url').notNull(),
  method: text('method').notNull(), // osm|google|crawl
  httpStatus: integer('http_status'),
  contentType: text('content_type'),
  effectiveUrl: text('effective_url'),
  isValid: boolean('is_valid').notNull(),
  errorMessage: text('error_message'),
  checkedAt: timestamp('checked_at').defaultNow().notNull(),
});

export type ExtCrawlRun = typeof extCrawlRuns.$inferSelect;
export type NewExtCrawlRun = typeof extCrawlRuns.$inferInsert;
export type ExtRestaurant = typeof extRestaurants.$inferSelect;
export type NewExtRestaurant = typeof extRestaurants.$inferInsert;
export type ExtRestaurantCheck = typeof extRestaurantChecks.$inferSelect;
export type NewExtRestaurantCheck = typeof extRestaurantChecks.$inferInsert;



