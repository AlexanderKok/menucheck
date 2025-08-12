import { runCompetitiveIngest } from '../services/competitive/pipeline';
import { getDatabase } from '../lib/db';
import { extRestaurants, extCrawlRuns } from '../schema/competitive';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

function parseArgs(): { location: string } {
  const args = process.argv.slice(2);
  let location = 'The Hague';
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--location' || a === '-l') {
      location = args[i + 1] || location;
      i++;
    } else if (!a.startsWith('--') && !a.startsWith('-')) {
      location = a;
    }
  }
  return { location };
}

async function main() {
  const { location } = parseArgs();
  const runId = await runCompetitiveIngest({ location });
  const db = await getDatabase();
  const rows = await db.select().from(extRestaurants).where(eq(extRestaurants.runId, runId as any));

  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const outDir = path.resolve(process.cwd(), '..', 'docs', 'temp_files');
  try { fs.mkdirSync(outDir, { recursive: true }); } catch {}
  const outPath = path.join(outDir, `combined_restaurants_${timestamp}.csv`);

  const header = [
    'name','addr_street','addr_housenumber','addr_postcode','addr_city','addr_country','latitude','longitude',
    'website_url','website_effective_url','website_http_status','website_is_valid','website_discovery_method',
    'menu_url','menu_http_status','menu_is_valid','menu_discovery_method'
  ];
  const csv = [header.join(',')].concat(rows.map((r: any) => [
    safe(r.name), safe(r.addrStreet), safe(r.addrHousenumber), safe(r.addrPostcode), safe(r.addrCity), safe(r.addrCountry), r.latitude ?? '', r.longitude ?? '',
    safe(r.websiteUrl), safe(r.websiteEffectiveUrl), r.websiteHttpStatus ?? '', r.websiteIsValid ? 'true' : 'false', safe(r.websiteDiscoveryMethod),
    safe(r.menuUrl), r.menuHttpStatus ?? '', r.menuIsValid ? 'true' : 'false', safe(r.menuDiscoveryMethod)
  ].join(',')) ).join('\n');
  fs.writeFileSync(outPath, csv, 'utf8');

  const [run] = await db.select().from(extCrawlRuns).where(eq(extCrawlRuns.id, runId as any)).limit(1);
  console.log('Run summary:', { runId, stats: (run as any)?.stats, export_path: outPath });
}

function safe(v: any): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});



