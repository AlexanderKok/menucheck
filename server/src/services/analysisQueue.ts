import { getDatabase } from '../lib/db';
import { analysisRuns, parseRuns } from '../schema/documents';
import { transitionDocumentStatus } from './stateMachine';
import { eq } from 'drizzle-orm';
import type { AnalysisJob } from '../types/url-parsing';

export class AnalysisQueue {
  private isProcessing = false;
  private queue: AnalysisJob[] = [];

  enqueueAnalysisJob(parseRunId: string, analysisVersion: string): string {
    const jobId = `analysis_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    this.queue.push({ id: jobId, parseRunId, analysisVersion, createdAt: new Date() });
    if (!this.isProcessing) setImmediate(() => this.processQueue());
    return jobId;
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;
    try {
      const job = this.queue.shift();
      if (job) await this.processJob(job);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processJob(job: AnalysisJob): Promise<void> {
    const db = await getDatabase();
    const [run] = await db.select().from(parseRuns).where(eq(parseRuns.id, job.parseRunId)).limit(1);
    if (!run) return;
    // Transition to analyzing
    try {
      await transitionDocumentStatus((run as any).documentId as string, 'analyzing');
    } catch {}

    // Placeholder analysis: just wraps rawOutput
    const analysisId = `ar_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    await db.insert(analysisRuns).values({
      id: analysisId as any,
      parseRunId: job.parseRunId,
      analysisVersion: job.analysisVersion,
      status: 'completed',
      analysisResults: (run as any).rawOutput || {},
      metrics: { generatedAt: new Date().toISOString() },
      startedAt: new Date(),
      completedAt: new Date(),
    } as any);

    // Transition to analyzed (leave 'done' to a later step when results are delivered)
    try {
      await transitionDocumentStatus((run as any).documentId as string, 'analyzed');
    } catch {}
  }
}

export const analysisQueue = new AnalysisQueue();


