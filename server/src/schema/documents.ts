import { pgTable, text, timestamp, integer, jsonb, index } from 'drizzle-orm/pg-core';
import { appSchema, users } from './users';

// Universal documents table for uploads and URLs
export const documents = appSchema.table(
  'documents',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    originalName: text('original_name'),
    mimeType: text('mime_type'),
    fileSize: integer('file_size'),
    storagePath: text('storage_path'), // Local path or URL
    sourceType: text('source_type'), // 'upload' | 'url'
    sourceUrl: text('source_url'), // Original URL if applicable
    documentType: text('document_type'), // Detected via content sniffing

    status: text('status').notNull().default('uploaded'),
    statusReason: text('status_reason'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    idxDocumentsUserId: index('idx_documents_user_id').on(table.userId),
    idxDocumentsStatus: index('idx_documents_status').on(table.status),
    idxDocumentsSourceType: index('idx_documents_source_type').on(table.sourceType),
  })
);

export const parseRuns = appSchema.table('parse_runs', {
  id: text('id').primaryKey(),
  documentId: text('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  parserVersion: text('parser_version').notNull(),
  parseMethod: text('parse_method').notNull(), // 'pdf_digital', 'pdf_ocr', 'html'
  status: text('status').notNull(), // 'running', 'completed', 'failed'
  confidence: integer('confidence'), // 0-100
  rawOutput: jsonb('raw_output'), // Parsed text, layout data, etc.
  metadata: jsonb('metadata'),
  errorMessage: text('error_message'),
  startedAt: timestamp('started_at').defaultNow(),
  completedAt: timestamp('completed_at'),
});

export const analysisRuns = appSchema.table('analysis_runs', {
  id: text('id').primaryKey(),
  parseRunId: text('parse_run_id').notNull().references(() => parseRuns.id, { onDelete: 'cascade' }),
  analysisVersion: text('analysis_version').notNull(),
  status: text('status').notNull(), // 'running', 'completed', 'failed'
  analysisResults: jsonb('analysis_results'),
  metrics: jsonb('metrics'),
  errorMessage: text('error_message'),
  startedAt: timestamp('started_at').defaultNow(),
  completedAt: timestamp('completed_at'),
});

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type ParseRun = typeof parseRuns.$inferSelect;
export type NewParseRun = typeof parseRuns.$inferInsert;
export type AnalysisRun = typeof analysisRuns.$inferSelect;
export type NewAnalysisRun = typeof analysisRuns.$inferInsert;


