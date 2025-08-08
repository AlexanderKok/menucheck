import 'dotenv/config';
import { getDatabase } from '../lib/db';
import { desc, eq } from 'drizzle-orm';
import { documents, parseRuns, analysisRuns } from '../schema/documents';

async function main() {
  const db = await getDatabase();

  const docs = await db.select().from(documents).orderBy(desc(documents.createdAt)).limit(5);
  if (docs.length === 0) {
    console.log('No documents found. Try uploading a menu first.');
    return;
  }

  console.log(`Found ${docs.length} recent documents:`);
  for (const d of docs) {
    console.log(`- ${d.id} | status=${d.status} | type=${d.documentType} | source=${d.sourceType} | created=${d.createdAt?.toISOString?.() ?? d.createdAt}`);
  }

  const latest = docs[0];
  console.log('\nLatest document details:');
  console.log(latest);

  const runs = await db
    .select()
    .from(parseRuns)
    .where(eq(parseRuns.documentId, latest.id))
    .orderBy(desc(parseRuns.startedAt))
    .limit(5);

  if (runs.length === 0) {
    console.log('\nNo parse_runs yet for latest document. It may still be queued.');
    return;
  }

  console.log(`\nParse runs (${runs.length}):`);
  for (const r of runs) {
    console.log(`- ${r.id} | status=${r.status} | method=${r.parseMethod} | conf=${r.confidence} | err=${r.errorMessage ?? ''} | started=${r.startedAt} | completed=${r.completedAt}`);
  }

  const latestRun = runs[0];
  const analyses = await db
    .select()
    .from(analysisRuns)
    .where(eq(analysisRuns.parseRunId, latestRun.id))
    .orderBy(desc(analysisRuns.startedAt))
    .limit(5);

  if (analyses.length === 0) {
    console.log('\nNo analysis_runs yet for latest parse run. It may still be queued or failed.');
    return;
  }

  console.log(`\nAnalysis runs (${analyses.length}):`);
  for (const a of analyses) {
    console.log(`- ${a.id} | status=${a.status} | version=${a.analysisVersion} | err=${a.errorMessage ?? ''} | started=${a.startedAt} | completed=${a.completedAt}`);
    console.log(`  metrics=${JSON.stringify(a.metrics)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


