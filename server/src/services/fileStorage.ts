import fs from 'node:fs/promises';
import path from 'node:path';

const BASE_DIR = process.env.DOCUMENTS_BASE_DIR || path.join(process.cwd(), 'uploads', 'documents');

export async function ensureBaseDir(): Promise<void> {
  await fs.mkdir(BASE_DIR, { recursive: true });
}

export async function storeDocument(contentBase64: string, userId: string, filename: string): Promise<string> {
  await ensureBaseDir();
  const userDir = path.join(BASE_DIR, userId);
  await fs.mkdir(userDir, { recursive: true });
  const documentId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const ext = path.extname(filename) || '.pdf';
  const filePath = path.join(userDir, `${documentId}${ext}`);
  const buffer = Buffer.from(contentBase64, 'base64');
  await fs.writeFile(filePath, buffer);
  return filePath;
}

export async function retrieveDocument(documentPath: string): Promise<Buffer> {
  const buffer = await fs.readFile(documentPath);
  return buffer;
}


