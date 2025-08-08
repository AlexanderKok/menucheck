import { getDatabase } from '../lib/db';
import { documents } from '../schema/documents';
import { eq } from 'drizzle-orm';

export type DocumentStatus =
  | 'uploaded' | 'queued' | 'parsing' | 'parsed'
  | 'analyzing' | 'analyzed' | 'done'
  | 'failed_parsing' | 'failed_analysis';

const validTransitions: Record<DocumentStatus, DocumentStatus[]> = {
  uploaded: ['queued', 'failed_parsing'],
  queued: ['parsing', 'failed_parsing'],
  parsing: ['parsed', 'failed_parsing'],
  parsed: ['analyzing', 'failed_analysis'],
  analyzing: ['analyzed', 'failed_analysis'],
  analyzed: ['done'],
  done: [],
  failed_parsing: ['queued'],
  failed_analysis: ['analyzing'],
};

export async function transitionDocumentStatus(
  documentId: string,
  newStatus: DocumentStatus,
  reason?: string
): Promise<void> {
  const db = await getDatabase();
  const [doc] = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1);
  const current = (doc?.status as DocumentStatus) || 'uploaded';
  if (!validTransitions[current]?.includes(newStatus)) {
    throw new Error(`Invalid transition from ${current} to ${newStatus}`);
  }
  await db.update(documents)
    .set({ status: newStatus, statusReason: reason ?? null, updatedAt: new Date() })
    .where(eq(documents.id, documentId));
}


