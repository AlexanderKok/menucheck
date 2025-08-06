import { pgTable, text, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';
import { appSchema, users } from './users';

export const consultations = appSchema.table('consultations', {
  id: text('id').primaryKey(),
  
  // Optional user association (for authenticated submissions)
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  
  // Business Information
  restaurantName: text('restaurant_name').notNull(),
  cuisineType: text('cuisine_type').notNull(),
  location: text('location').notNull(),
  establishedYear: text('established_year'),
  
  // Contact Information
  contactName: text('contact_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull(),
  
  // Business Details
  seatingCapacity: text('seating_capacity').notNull(),
  serviceTypes: jsonb('service_types').notNull(), // array of service types
  priceRange: text('price_range').notNull(),
  currentChallenges: jsonb('current_challenges'), // array of challenges
  
  // Goals and Preferences
  primaryGoals: jsonb('primary_goals').notNull(), // array of goals
  timeframe: text('timeframe').notNull(),
  budget: text('budget').notNull(),
  additionalNotes: text('additional_notes'),
  
  // Consent and Legal
  marketingConsent: boolean('marketing_consent').default(false),
  termsAccepted: boolean('terms_accepted').notNull().default(false),
  
  // Processing Status
  status: text('status').notNull().default('pending'), // pending, reviewed, contacted, scheduled, completed, cancelled
  assignedConsultant: text('assigned_consultant'),
  scheduledDate: timestamp('scheduled_date'),
  
  // Internal Notes
  internalNotes: text('internal_notes'),
  priority: text('priority').default('medium'), // high, medium, low
  
  // Metadata
  source: text('source').default('website'), // website, referral, etc.
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  
  // Follow-up tracking
  lastContactedAt: timestamp('last_contacted_at'),
  nextFollowUpAt: timestamp('next_follow_up_at'),
});

export const consultationMessages = appSchema.table('consultation_messages', {
  id: text('id').primaryKey(),
  consultationId: text('consultation_id').notNull().references(() => consultations.id, { onDelete: 'cascade' }),
  
  // Message Details
  type: text('type').notNull(), // email, phone, meeting, note
  direction: text('direction').notNull(), // inbound, outbound
  subject: text('subject'),
  content: text('content').notNull(),
  
  // Sender/Recipient
  senderName: text('sender_name'),
  senderEmail: text('sender_email'),
  recipientName: text('recipient_name'),
  recipientEmail: text('recipient_email'),
  
  // Metadata
  messageDate: timestamp('message_date').notNull(),
  isRead: boolean('is_read').default(false),
  attachments: jsonb('attachments'), // array of attachment URLs/metadata
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const consultationDocuments = appSchema.table('consultation_documents', {
  id: text('id').primaryKey(),
  consultationId: text('consultation_id').notNull().references(() => consultations.id, { onDelete: 'cascade' }),
  
  // Document Details
  name: text('name').notNull(),
  type: text('type').notNull(), // proposal, contract, menu_analysis, report
  fileName: text('file_name').notNull(),
  fileUrl: text('file_url').notNull(),
  fileSize: text('file_size'),
  mimeType: text('mime_type'),
  
  // Document Status
  status: text('status').default('draft'), // draft, sent, viewed, signed, approved
  version: text('version').default('1.0'),
  
  // Tracking
  sentAt: timestamp('sent_at'),
  viewedAt: timestamp('viewed_at'),
  signedAt: timestamp('signed_at'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type Consultation = typeof consultations.$inferSelect;
export type NewConsultation = typeof consultations.$inferInsert;

export type ConsultationMessage = typeof consultationMessages.$inferSelect;
export type NewConsultationMessage = typeof consultationMessages.$inferInsert;

export type ConsultationDocument = typeof consultationDocuments.$inferSelect;
export type NewConsultationDocument = typeof consultationDocuments.$inferInsert;