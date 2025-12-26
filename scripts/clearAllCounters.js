import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load Supabase credentials from supabaseConfig.ts or env
const cfgPath = path.resolve(process.cwd(), 'supabaseConfig.ts');
let supabaseUrl = process.env.SUPABASE_URL || '';
let supabaseKey = process.env.SUPABASE_KEY || '';
if (fs.existsSync(cfgPath)) {
  const txt = fs.readFileSync(cfgPath, 'utf8');
  const urlMatch = txt.match(/url:\s*"([^"]+)"/);
  const keyMatch = txt.match(/anonKey:\s*"([^"]+)"/);
  if (urlMatch) supabaseUrl = urlMatch[1];
  if (keyMatch) supabaseKey = keyMatch[1];
}
if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase credentials not found. Set SUPABASE_URL and SUPABASE_KEY env vars or configure supabaseConfig.ts');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

(async () => {
  try {
    console.log('Fetching all ids from flight_schedule...');
    
    // Use pagination to fetch all IDs, not just first 1000
    const allIds = [];
    let offset = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: rows, error: selErr } = await supabase
        .from('flight_schedule')
        .select('id')
        .range(offset, offset + pageSize - 1);
      
      if (selErr) throw selErr;
      
      const pageIds = (rows || []).map(r => r.id);
      console.log(`Fetched page offset=${offset}: ${pageIds.length} rows`);
      
      if (pageIds.length === 0) {
        hasMore = false;
      } else {
        allIds.push(...pageIds);
        if (pageIds.length < pageSize) {
          hasMore = false; // Last page
        } else {
          offset += pageSize;
        }
      }
    }

    if (allIds.length === 0) {
      console.log('No rows found. Nothing to do.');
      return;
    }

    console.log('Total rows to clear:', allIds.length);

    const chunkSize = 200;
    let updated = 0;
    for (let i = 0; i < allIds.length; i += chunkSize) {
      const chunk = allIds.slice(i, i + chunkSize);
      const { error: upErr } = await supabase.from('flight_schedule').update({ counters: [] }).in('id', chunk);
      if (upErr) {
        console.error('Failed updating chunk starting at', i, upErr);
      } else {
        updated += chunk.length;
        console.log('Updated chunk', i, '->', Math.min(i+chunkSize, allIds.length));
      }
      // short pause to avoid overwhelming DB
      await sleep(200);
    }

    console.log('Done. Total updated (approx):', updated);
  } catch (e) {
    console.error('Clear failed', e);
    process.exit(1);
  }
})();
