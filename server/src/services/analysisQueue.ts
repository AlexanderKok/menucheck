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
    this.queue.push({ id: jobId, parseRunId, analysisVersion, createdAt: new Date(), retryCount: 0, maxRetries: 3 });
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
      // Drain remaining jobs if any
      if (this.queue.length > 0) setImmediate(() => this.processQueue());
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

    try {
      const rawOutput = (run as any).rawOutput as any;
      const analysisId = `ar_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

      // Normalize items from parse result
      const items = Array.isArray(rawOutput?.menuItems)
        ? rawOutput.menuItems.map((it: any) => ({
            name: it.name,
            description: it.description ?? undefined,
            price: typeof it.price === 'number' ? it.price : undefined,
            currency: it.currency ?? undefined,
            category: it.category ?? undefined,
          }))
        : [];

      const categoriesSet = new Map<string, number>();
      for (const item of items) {
        if (item.category) {
          categoriesSet.set(item.category, (categoriesSet.get(item.category) ?? 0) + 1);
        }
      }
      const categories = Array.from(categoriesSet.entries()).map(([name, count]) => ({ name, count }));

      const prices = items.map((i: any) => i.price).filter((p: any): p is number => typeof p === 'number');
      const totalItems = items.length;
      const avgPrice = prices.length ? prices.reduce((a: number, b: number) => a + b, 0) / prices.length : null;
      const minPrice = prices.length ? Math.min(...prices) : null;
      const maxPrice = prices.length ? Math.max(...prices) : null;
      const hasPriceAndName = items.filter((i: any) => i.name && typeof i.price === 'number').length;
      const parseConfidence = typeof rawOutput?.confidence === 'number' ? rawOutput.confidence : 0;
      const completeness = totalItems ? hasPriceAndName / totalItems : 0;
      const qualityScore = Math.round(0.6 * parseConfidence + 40 * completeness);

      await db.insert(analysisRuns).values({
        id: analysisId as any,
        parseRunId: job.parseRunId,
        analysisVersion: job.analysisVersion,
        status: 'completed',
        analysisResults: { items, categories },
        metrics: {
          totalItems,
          avgPrice,
          minPrice,
          maxPrice,
          categoryDistribution: categories,
          qualityScore,
        },
        startedAt: new Date(),
        completedAt: new Date(),
      } as any);

      // Transition analyzed -> done
      try {
        await transitionDocumentStatus((run as any).documentId as string, 'analyzed');
        await transitionDocumentStatus((run as any).documentId as string, 'done');
      } catch {}
    } catch (error: any) {
      // Insert failed analysis run
      const analysisId = `ar_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      await db.insert(analysisRuns).values({
        id: analysisId as any,
        parseRunId: job.parseRunId,
        analysisVersion: job.analysisVersion,
        status: 'failed',
        analysisResults: null,
        metrics: null,
        errorMessage: error?.message || 'analysis failed',
        startedAt: new Date(),
        completedAt: new Date(),
      } as any);

      const currentRetry = job.retryCount ?? 0;
      const maxRetries = job.maxRetries ?? 3;
      if (currentRetry < maxRetries) {
        const nextRetry = currentRetry + 1;
        const backoffMs = Math.min(60000, Math.pow(2, currentRetry) * 5000);
        const requeued: AnalysisJob = { ...job, id: `analysis_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`, retryCount: nextRetry } as any;
        setTimeout(() => {
          this.queue.push(requeued);
          if (!this.isProcessing) setImmediate(() => this.processQueue());
        }, backoffMs);
      } else {
        try {
          await transitionDocumentStatus((run as any).documentId as string, 'failed_analysis', error?.message);
        } catch {}
      }
    }
  }
}

export const analysisQueue = new AnalysisQueue();


