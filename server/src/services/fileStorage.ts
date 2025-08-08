import fs from 'node:fs/promises';
import path from 'node:path';

// Allow overriding uploads root directory via env. Falls back to local server/uploads/documents
const BASE_DIR = process.env.UPLOADS_ROOT
  || process.env.DOCUMENTS_BASE_DIR
  || path.join(process.cwd(), 'uploads', 'documents');

function sanitizeFilename(name: string): string {
  // Remove path separators and dangerous characters; collapse spaces
  const base = name.replace(/\\|\//g, ' ').replace(/[^a-zA-Z0-9._-]+/g, ' ').trim();
  return base || 'document.pdf';
}

export async function ensureBaseDir(): Promise<void> {
  await fs.mkdir(BASE_DIR, { recursive: true });
}

export async function storeDocument(contentBase64: string, userId: string, filename: string): Promise<string> {
  await ensureBaseDir();
  const safeUserId = (userId || 'public').replace(/[^a-zA-Z0-9_-]/g, '_');
  const userDir = path.join(BASE_DIR, safeUserId);
  await fs.mkdir(userDir, { recursive: true });
  const documentId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const safeName = sanitizeFilename(filename || 'document.pdf');
  const ext = path.extname(safeName) || '.pdf';
  const filePath = path.join(userDir, `${documentId}${ext}`);
  const buffer = Buffer.from(contentBase64, 'base64');
  await fs.writeFile(filePath, buffer);
  return filePath;
}

export async function retrieveDocument(documentPath: string): Promise<Buffer> {
  const buffer = await fs.readFile(documentPath);
  return buffer;
}


