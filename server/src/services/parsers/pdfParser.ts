import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';
import type { ParseResult } from '../../types/url-parsing';

const execAsync = promisify(execCb);

function bufferFromBase64(base64: string): Uint8Array {
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

function detectCurrencySymbol(text: string): string | undefined {
  if (/€/.test(text)) return 'EUR';
  if (/£/.test(text)) return 'GBP';
  if (/\$/.test(text)) return 'USD';
  return undefined;
}

const PRICE_REGEX = /(?:[€$£]\s?)?\d{1,3}(?:[.,]\d{2})/;

export async function parseDigitalPdf(_: string, fileContentBase64?: string): Promise<ParseResult> {
  try {
    if (!fileContentBase64) {
      return { success: false, menuItems: [], categories: [], parseMethod: 'pdf_digital', confidence: 0, errorMessage: 'Missing file content' };
    }

    const pdfjsLib: any = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const data = bufferFromBase64(fileContentBase64);
    const loadingTask = pdfjsLib.getDocument({ data });
    const pdf = await loadingTask.promise;

    const maxPages = Math.min(pdf.numPages, 6);
    const tokens: Array<{ x: number; y: number; str: string }> = [];
    for (let p = 1; p <= maxPages; p++) {
      const page = await pdf.getPage(p);
      const textContent = await page.getTextContent();
      for (const item of textContent.items as any[]) {
        const t = item.transform || item?.transformMatrix || [1, 0, 0, 1, 0, 0];
        const x = t[4];
        const y = t[5];
        const str = (item.str as string) ?? '';
        tokens.push({ x, y, str });
      }
    }
    // Group tokens into y-bands
    const bandSize = 8;
    const bands = new Map<number, Array<{ x: number; y: number; str: string }>>();
    for (const t of tokens) {
      const bandKey = Math.round(t.y / bandSize) * bandSize;
      const arr = bands.get(bandKey) || [];
      arr.push(t);
      bands.set(bandKey, arr);
    }
    // Build lines
    const lines = Array.from(bands.entries())
      .sort((a, b) => b[0] - a[0]) // y descending (top to bottom may vary)
      .map(([_, arr]) => arr.sort((a, b) => a.x - b.x).map((t) => t.str).join(' ').replace(/\s{2,}/g, ' ').trim())
      .filter((line) => line.length > 0);

    // Column detection within bands
    const columnBoundaries: Array<{ xStart: number; xEnd: number }> = [];
    let columnCount = 1;
    // Collect representative x positions per band
    const xPositions: number[] = [];
    for (const arr of bands.values()) {
      const xs = arr.map((t) => t.x).sort((a, b) => a - b);
      if (xs.length) xPositions.push(xs[0]);
    }
    if (xPositions.length > 4) {
      const sortedX = [...new Set(xPositions.map((v) => Math.round(v)))].sort((a, b) => a - b);
      const gaps: number[] = [];
      for (let i = 1; i < sortedX.length; i++) gaps.push(sortedX[i] - sortedX[i - 1]);
      const mean = gaps.reduce((a, b) => a + b, 0) / Math.max(1, gaps.length);
      const variance = gaps.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / Math.max(1, gaps.length);
      const std = Math.sqrt(variance);
      const threshold = Math.max(40, mean + std); // 40–60px typical threshold; adaptive using mean+std
      // Split columns by large gaps
      const cuts: number[] = [];
      for (let i = 1; i < sortedX.length; i++) {
        if (sortedX[i] - sortedX[i - 1] > threshold) cuts.push(i);
      }
      if (cuts.length > 0) {
        columnCount = cuts.length + 1;
        const partitions: number[][] = [];
        let start = 0;
        for (const cut of cuts) {
          partitions.push(sortedX.slice(start, cut));
          start = cut;
        }
        partitions.push(sortedX.slice(start));
        for (const part of partitions) {
          if (part.length) {
            columnBoundaries.push({ xStart: part[0] - 5, xEnd: part[part.length - 1] + 5 });
          }
        }
      }
    }

    const items: Array<{ name: string; description?: string; price: number; currency: string; category?: string }> = [];
    const categories: string[] = [];
    let currentCategory: string | undefined;

    // Track last line y per band to help with heading by y-gap
    const bandKeysDesc = Array.from(bands.keys()).sort((a, b) => b - a);
    const bandIndexByLine: number[] = [];
    let idx = 0;
    for (const [bandKey, arr] of Array.from(bands.entries()).sort((a, b) => b[0] - a[0])) {
      // map each produced line to its band index via iteration order
      bandIndexByLine.push(bandKeysDesc.indexOf(bandKey));
      idx++;
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isHeadingText = line.length < 40 && line === line.toUpperCase() && !PRICE_REGEX.test(line);
      // y-gap heuristic: if next line is far in y (band index jumps), treat as heading
      const bandIdx = bandIndexByLine[i] ?? 0;
      const nextBandIdx = bandIndexByLine[i + 1] ?? bandIdx;
      const bigGap = nextBandIdx - bandIdx >= 2; // larger gap means spacing separator
      const isHeading = isHeadingText || (bigGap && !PRICE_REGEX.test(line));
      if (isHeading) {
        currentCategory = line;
        if (!categories.includes(currentCategory)) categories.push(currentCategory);
        continue;
      }
      const priceMatch = line.match(PRICE_REGEX);
      if (priceMatch) {
        const priceText = priceMatch[0];
        const currency = detectCurrencySymbol(priceText) || '';
        const numeric = parseFloat(priceText.replace(/[^0-9.,]/g, '').replace(',', '.'));
        // Name is text before price, trimmed. Restrict to left of price within same column if columns detected
        let name = line.slice(0, line.indexOf(priceText)).replace(/[\s\-–:\u00A0]+$/g, '').trim();
        if (name && isFinite(numeric)) {
          items.push({ name, price: numeric, currency, category: currentCategory });
        }
      }
    }

    const success = items.length > 0;
    const withPrice = items.filter((i) => typeof i.price === 'number').length;
    const confidence = Math.min(100, Math.round(60 + (withPrice / Math.max(1, items.length)) * 40));

    const result: ParseResult & { layoutMetadata?: any } = {
      success,
      menuItems: items,
      categories,
      parseMethod: 'pdf_digital',
      confidence: success ? confidence : 0,
    };
    (result as any).layoutMetadata = {
      columnCount,
      columnBoundaries,
      bandSize,
      totalLines: lines.length,
      linesSample: lines.slice(0, 10),
    };
    return result;
  } catch (error) {
    return {
      success: false,
      menuItems: [],
      categories: [],
      parseMethod: 'pdf_digital',
      confidence: 0,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function ensureLocalPdf(source: string): Promise<string> {
  // If source is HTTP(S), download
  if (/^https?:\/\//i.test(source)) {
    const res = await fetch(source);
    if (!res.ok) throw new Error(`Failed to download PDF: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ocr-'));
    const tmpFile = path.join(tmpDir, 'input.pdf');
    await fs.writeFile(tmpFile, buf);
    return tmpFile;
  }
  return source;
}

export async function parseScannedPdf(source: string): Promise<ParseResult> {
  try {
    const localPdf = await ensureLocalPdf(source);
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pdftoppm-'));
    const prefix = path.join(tmpDir, 'page');
    const maxPages = 3;
    // Rasterize first N pages
    await execAsync(`pdftoppm -f 1 -l ${maxPages} -png -r 200 "${localPdf}" "${prefix}"`);

    // OCR each generated PNG
    const Tesseract = (await import('tesseract.js')).default;
    const texts: string[] = [];
    const confidences: number[] = [];
    for (let i = 1; i <= maxPages; i++) {
      const imgPath = `${prefix}-${i}.png`;
      try {
        const result: any = await Tesseract.recognize(imgPath, 'eng');
        texts.push(result?.data?.text || '');
        if (typeof result?.data?.confidence === 'number') confidences.push(result.data.confidence);
      } catch {}
    }
    const fullText = texts.join('\n');
    const avgOcr = confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0;

    // Simple heuristic line parsing
    const items: Array<{ name: string; description?: string; price: number; currency: string; category?: string }> = [];
    const categories: string[] = [];
    let currentCategory: string | undefined;
    for (const rawLine of fullText.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;
      const isHeading = line.length < 40 && line === line.toUpperCase() && !PRICE_REGEX.test(line);
      if (isHeading) {
        currentCategory = line;
        if (!categories.includes(line)) categories.push(line);
        continue;
      }
      const priceMatch = line.match(PRICE_REGEX);
      if (priceMatch) {
        const priceText = priceMatch[0];
        const currency = detectCurrencySymbol(priceText) || '';
        const numeric = parseFloat(priceText.replace(/[^0-9.,]/g, '').replace(',', '.'));
        const name = line.slice(0, line.indexOf(priceText)).replace(/[\s\-–:\u00A0]+$/g, '').trim();
        if (name && isFinite(numeric)) items.push({ name, price: numeric, currency, category: currentCategory });
      }
    }

    const success = items.length > 0;
    const confidence = Math.round(0.5 * avgOcr + (success ? 40 : 0));
    try { await fs.rm(tmpDir, { recursive: true, force: true }); } catch {}

    return { success, menuItems: items, categories, parseMethod: 'pdf_ocr', confidence };
  } catch (error) {
    return {
      success: false,
      menuItems: [],
      categories: [],
      parseMethod: 'pdf_ocr',
      confidence: 0,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}