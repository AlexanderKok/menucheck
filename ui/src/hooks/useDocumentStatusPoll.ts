import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/serverComm';

export type DocumentStatus = {
  document: {
    id: string;
    status: string;
    statusReason?: string | null;
    documentType?: string | null;
    sourceType?: string | null;
    createdAt?: string;
    updatedAt?: string;
  };
  parseRun: null | {
    id: string;
    status: string;
    parseMethod?: string | null;
    confidence?: number | null;
    errorMessage?: string | null;
    startedAt?: string;
    completedAt?: string;
  };
  analysisRun: null | {
    id: string;
    status: string;
    analysisVersion?: string | null;
    metrics?: any;
    errorMessage?: string | null;
    startedAt?: string;
    completedAt?: string;
  };
};

export function useDocumentStatusPoll(
  documentId: string | null | undefined,
  opts: { intervalMs?: number; maxWaitMs?: number } = {}
) {
  const { intervalMs = 3000, maxWaitMs = 300000 } = opts;
  const [status, setStatus] = useState<DocumentStatus | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const stoppedRef = useRef(false);
  const currentIntervalRef = useRef(intervalMs);

  const isTerminal = useCallback((s: DocumentStatus | null) => {
    if (!s) return false;
    // Treat missing runs as not done to avoid stopping before jobs are created
    const parseDone = s.parseRun ? ['completed', 'failed'].includes(s.parseRun.status) : false;
    const analysisDone = s.analysisRun ? ['completed', 'failed'].includes(s.analysisRun.status) : false;
    const docDone = ['completed', 'failed'].includes(s.document.status);
    return (parseDone && analysisDone) || docDone;
  }, []);

  const fetchOnce = useCallback(async () => {
    if (!documentId) return;
    try {
      const res = await api.getDocumentStatus(documentId);
      setStatus(res);
      setError(null);
      return res as DocumentStatus;
    } catch (e: any) {
      setError(e?.message || 'Failed to fetch status');
      return null;
    }
  }, [documentId]);

  const stop = useCallback(() => {
    stoppedRef.current = true;
    setIsPolling(false);
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(async () => {
    if (!documentId) return;
    stop();
    stoppedRef.current = false;
    setIsPolling(true);
    startedAtRef.current = Date.now();
    currentIntervalRef.current = intervalMs;

    const tick = async () => {
      if (stoppedRef.current) return;
      const res = await fetchOnce();
      if (res && isTerminal(res)) {
        stop();
        return;
      }
      const elapsed = startedAtRef.current ? Date.now() - startedAtRef.current : 0;
      if (elapsed > maxWaitMs) {
        stop();
        return;
      }
      // Exponential backoff up to 12s
      currentIntervalRef.current = Math.min(currentIntervalRef.current * 1.5, 12000);
      timerRef.current = window.setTimeout(tick, currentIntervalRef.current) as any;
    };

    // initial immediate fetch
    await tick();
  }, [documentId, fetchOnce, intervalMs, isTerminal, maxWaitMs, stop]);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  return { status, isPolling, error, start, stop, refresh: fetchOnce };
}


