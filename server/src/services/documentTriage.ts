import path from 'node:path';
import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';
import { storeDocument } from './fileStorage';
import { getDatabase } from '../lib/db';
import { documents } from '../schema/documents';
import type { DocumentType, ParseStrategy } from '../types/url-parsing';
import { routeToParser } from './parseRouter';

const execAsync = promisify(execCb);

export interface DocumentInput {
  type: 'url' | 'file';
  source: string | { content: string; mimeType: string; name?: string };
  userId?: string;
}

export interface DocumentTriageResult {
  documentId: string;
  documentType: DocumentType;
  processingStrategy: ParseStrategy;
  storageLocation: string;
  contentAnalysis: {
    textRatio: number;
    pageCount: number;
    hasImages: boolean;
    confidence: number;
  };
}

export async function triageDocument(input: DocumentInput): Promise<DocumentTriageResult> {
  const db = await getDatabase();

  if (input.type === 'file') {
    const src = input.source as { content: string; mimeType: string; name?: string };
    const storagePath = await storeDocument(src.content, input.userId || 'public', src.name || 'document.pdf');

    const detectedType = await detectDocumentType(storagePath, src.mimeType);
    const strategy = routeToParser(detectedType, src.mimeType);

    const documentId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    await db.insert(documents).values({
      id: documentId,
      userId: input.userId || null,
      originalName: src.name || null,
      mimeType: src.mimeType,
      fileSize: null,
      storagePath,
      sourceType: 'upload',
      sourceUrl: null,
      documentType: detectedType,
      status: 'uploaded',
    });

    return {
      documentId,
      documentType: detectedType,
      processingStrategy: strategy,
      storageLocation: storagePath,
      contentAnalysis: {
        textRatio: 1,
        pageCount: 1,
        hasImages: false,
        confidence: 80,
      },
    };
  }

  // URL handling placeholder (Phase 3 will unify with queue)
  const url = input.source as string;
  const documentId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  await db.insert(documents).values({
    id: documentId,
    userId: input.userId || null,
    originalName: null,
    mimeType: 'text/html',
    fileSize: null,
    storagePath: url,
    sourceType: 'url',
    sourceUrl: url,
    documentType: 'html_static',
    status: 'uploaded',
  });

  return {
    documentId,
    documentType: 'html_static',
    processingStrategy: 'html',
    storageLocation: url,
    contentAnalysis: { textRatio: 1, pageCount: 1, hasImages: false, confidence: 60 },
  };
}

export async function detectDocumentType(filePath: string, mimeType?: string): Promise<DocumentType> {
  if (path.extname(filePath).toLowerCase() === '.pdf' || mimeType === 'application/pdf') {
    try {
      await execAsync(`pdfinfo "${filePath}"`);
      const { stdout } = await execAsync(`pdftotext -f 1 -l 1 "${filePath}" -`);
      const textRatio = stdout && stdout.trim().length > 50 ? 0.5 : 0.1;
      return textRatio < 0.3 ? 'scanned_pdf' : 'digital_pdf';
    } catch {
      return 'digital_pdf';
    }
  }
  if (mimeType === 'text/html') {
    return 'html_static';
  }
  throw new Error(`Unsupported file type for triage: ${filePath}`);
}


