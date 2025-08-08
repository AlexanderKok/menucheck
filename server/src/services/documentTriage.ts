import path from 'node:path';
import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';
import { storeDocument } from './fileStorage';
import { getDatabase } from '../lib/db';
import { documents } from '../schema/documents';
import type { DocumentType, ParseStrategy } from '../types/url-parsing';
import { routeToParser } from './parseRouter';
import { UrlParser } from './urlParser';

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
    textRatio?: number;
    pageCount?: number;
    hasImages?: boolean;
    confidence: number;
  };
}

export async function triageDocument(input: DocumentInput): Promise<DocumentTriageResult> {
  const db = await getDatabase();
  const urlParser = new UrlParser();

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
        confidence: 80,
      },
    };
  }

  // URL handling
  const url = input.source as string;
  const detected = await urlParser.detectDocumentType(url);
  const mime = detected.sourceType === 'pdf' ? 'application/pdf' : 'text/html';
  const documentId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  await db.insert(documents).values({
    id: documentId,
    userId: input.userId || null,
    originalName: null,
    mimeType: mime,
    fileSize: null,
    storagePath: url,
    sourceType: 'url',
    sourceUrl: url,
    documentType: detected.documentType,
    status: 'uploaded',
  });

  return {
    documentId,
    documentType: detected.documentType,
    processingStrategy: detected.strategy,
    storageLocation: url,
    contentAnalysis: { confidence: 60 },
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
      // If pdf tools are missing, default to digital
      return 'digital_pdf';
    }
  }
  if (mimeType === 'text/html') {
    return 'html_static';
  }
  throw new Error(`Unsupported file type for triage: ${filePath}`);
}


