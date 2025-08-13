import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { getEnv } from '../lib/env';
import { generateDomainCandidates } from '../services/competitive/nameToDomain';
import { validateUrl, isSocial } from '../services/competitive/urlResolution';
import { computeMatchScore, fetchHtml } from '../services/competitive/siteVerification';
import { search as ddgSearch } from '../services/competitive/duckDuckGoSearch';

type Row = {
  name: string;
  addr_street?: string;
  addr_housenumber?: string;
  addr_postcode?: string;
  addr_city?: string;
  website_url?: string;
};

function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      if (typeof v === 'undefined') args[k] = true; else args[k] = v;
    }
  }
  return args as { file: string; limit?: string; methods?: string; rate?: string; 'min-score'?: string };
}

function delay(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

async function validateAndScore(candidateUrl: string, expected: any, perHostLimit = 5): Promise<{ accepted: boolean; finalUrl?: string; httpStatus?: number; contentType?: string; score?: number }>
{
  const res = await validateUrl(candidateUrl);
  if (!res.isValid || isSocial(res.effectiveUrl || candidateUrl)) return { accepted: false };
  const htmlRes = await fetchHtml(res.effectiveUrl || candidateUrl);
  if (!htmlRes.html) return { accepted: false };
  const score = computeMatchScore(res.effectiveUrl || candidateUrl, htmlRes.html, expected);
  const accepted = score >= Number(getEnv('FALLBACK_VERIFY_MIN_SCORE') || '60');
  return { accepted, finalUrl: res.effectiveUrl || candidateUrl, httpStatus: res.httpStatus ?? htmlRes.status, contentType: res.contentType ?? htmlRes.contentType, score };
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.file) {
    console.error('Usage: tsx src/scripts/test-enrich-from-csv.ts --file=/abs/path.csv [--limit=30] [--methods=guess,duckduckgo] [--rate=0.2] [--min-score=60]');
    process.exit(1);
  }
  const limit = args.limit ? Number(args.limit) : 30;
  const methods = (args.methods || 'guess,duckduckgo').split(',').map((m) => m.trim());
  const minScore = args['min-score'] ? Number(args['min-score']) : Number(getEnv('FALLBACK_VERIFY_MIN_SCORE') || '60');

  const content = readFileSync(args.file, 'utf8');
  const rows = parse(content, { columns: true, skip_empty_lines: true }) as Row[];
  const subset = rows.slice(0, limit);

  console.log(`Testing ${subset.length} rows from ${args.file} with methods=${methods.join(',')} minScore=${minScore}`);

  let success = 0;
  for (let i = 0; i < subset.length; i++) {
    const r = subset[i];
    const expected = {
      name: r.name,
      street: r.addr_street,
      housenumber: r.addr_housenumber,
      postcode: r.addr_postcode,
      city: r.addr_city,
    };
    let finalUrl: string | undefined; let methodUsed: string | undefined; let httpStatus: number | undefined; let score: number | undefined;
    console.log(`\n[${i + 1}/${subset.length}] ${r.name} (${r.addr_city || 'unknown city'})`);

    if (!finalUrl && methods.includes('guess')) {
      const candidates = generateDomainCandidates(r.name, r.addr_city);
      for (const cand of candidates) {
        const res = await validateAndScore(cand, expected);
        const s = res.score ?? 0;
        console.log(`  heuristic -> ${cand} | accepted=${res.accepted} score=${s} status=${res.httpStatus}`);
        if (res.accepted && res.finalUrl) { finalUrl = res.finalUrl; methodUsed = 'heuristic'; httpStatus = res.httpStatus; score = res.score; break; }
      }
    }

    if (!finalUrl && methods.includes('duckduckgo')) {
      const links = await ddgSearch(r.name, r.addr_city, { rateRps: args.rate ? Number(args.rate) : undefined });
      for (const link of links) {
        const res = await validateAndScore(link, expected);
        const s = res.score ?? 0;
        console.log(`  duckduckgo -> ${link} | accepted=${res.accepted} score=${s} status=${res.httpStatus}`);
        if (res.accepted && res.finalUrl) { finalUrl = res.finalUrl; methodUsed = 'duckduckgo'; httpStatus = res.httpStatus; score = res.score; break; }
        await delay(200);
      }
    }

    if (finalUrl) { success += 1; console.log(`  ✅ Found: ${finalUrl} via ${methodUsed} (status=${httpStatus}, score=${score})`); }
    else { console.log('  ❌ No valid website found'); }
    await delay(250);
  }

  console.log(`\nDone. Found ${success}/${subset.length} websites.`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });


