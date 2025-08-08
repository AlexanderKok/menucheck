import { getDatabase } from '../lib/db';
import { documents, parseRuns } from '../schema/documents';
import { eq } from 'drizzle-orm';
import { retrieveDocument } from './fileStorage';
import { routeToParser } from './parseRouter';
import { transitionDocumentStatus } from './stateMachine';
import { UrlParser } from './urlParser';
import { analysisQueue } from './analysisQueue';
import { parseDigitalPdf, parseScannedPdf } from './parsers/pdfParser';
import type { UnifiedParseJob, ParseStrategy } from '../types/url-parsing';

const urlParser = new UrlParser();

export class ParseQueueV2 {
  private isProcessing = false;
  private queue: UnifiedParseJob[] = [];

  enqueueParseJob(documentId: string, parserVersion: string): string {
    const jobId = `p2_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    this.queue.push({
      id: jobId,
      documentId,
      runId,
      inputType: 'file',
      inputSource: documentId,
      parserVersion,
      createdAt: new Date(),
    });
    if (!this.isProcessing) setImmediate(() => this.processQueue());
    return jobId;
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;
    try {
      const job = this.queue.shift();
      if (job) await this.processJob(job);
    } catch (err) {
      // noop
    } finally {
      this.isProcessing = false;
      if (this.queue.length > 0) setImmediate(() => this.processQueue());
    }
  }

  private async processJob(job: UnifiedParseJob): Promise<void> {
    const db = await getDatabase();
    const [doc] = await db.select().from(documents).where(eq(documents.id, job.documentId)).limit(1);
    if (!doc) return;

    await transitionDocumentStatus(job.documentId, 'parsing');

    const mimeType = (doc as any).mimeType as string | null;
    const docType = (doc as any).documentType as string | null;
    const sourceType = (doc as any).sourceType as string | null;
    const storagePath = (doc as any).storagePath as string;

    // Decide strategy if not present
    let strategy: ParseStrategy;
    if (mimeType && docType) {
      strategy = routeToParser(docType as any, mimeType);
    } else if (sourceType === 'url') {
      const detected = await urlParser.detectDocumentType(storagePath);
      strategy = detected.strategy;
    } else {
      strategy = 'pdf_digital';
    }

    // Create parse run record (running)
    await db.insert(parseRuns).values({
      id: job.runId,
      documentId: job.documentId,
      parserVersion: job.parserVersion,
      parseMethod: strategy,
      status: 'running',
      startedAt: new Date(),
      metadata: { strategy },
    } as any);

    try {
      let parseResult;
      if (strategy === 'pdf_digital') {
        const buffer = await retrieveDocument(storagePath);
        const base64 = buffer.toString('base64');
        parseResult = await parseDigitalPdf('', base64);
      } else if (strategy === 'pdf_ocr') {
        parseResult = await parseScannedPdf(storagePath);
      } else if (strategy === 'html' || strategy === 'javascript') {
        parseResult = await urlParser.parseUrl(storagePath, strategy);
      } else {
        throw new Error(`Unsupported parse strategy: ${strategy}`);
      }

      await db.update(parseRuns)
        .set({
          status: parseResult.success ? 'completed' : 'failed',
          confidence: parseResult.confidence,
          rawOutput: parseResult as any,
          completedAt: new Date(),
        })
        .where(eq(parseRuns.id, job.runId));

      await transitionDocumentStatus(job.documentId, parseResult.success ? 'parsed' : 'failed_parsing');

      if (parseResult.success) {
        // Kick off analysis
        analysisQueue.enqueueAnalysisJob(job.runId, 'v1');
      }

    } catch (error: any) {
      await db.update(parseRuns)
        .set({ status: 'failed', errorMessage: error?.message || 'parse failed', completedAt: new Date() })
        .where(eq(parseRuns.id, job.runId));
      await transitionDocumentStatus(job.documentId, 'failed_parsing', error?.message);
    }
  }
}

export const parseQueueV2 = new ParseQueueV2();


