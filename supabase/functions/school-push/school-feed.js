import {SUPABASE_PROJECT_URL, SUPABASE_PUBLISHABLE_KEY} from './supabase-materials.js';
import {normalizeSupabaseAnnouncement} from './supabase-announcements.js';
import {classifyTestPdf, isTestNotice, cleanSchoolText} from './test-recognition.js';

// A source revision gives the migrated catalogue its own silent baseline.
export const FEED_ID = 'supabase:' + new URL(SUPABASE_PROJECT_URL).hostname.split('.')[0];
export const INTERVAL_MINUTES = 1;
const sha = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(n => n.toString(16).padStart(2, '0')).join('');

export async function sourceEvents(collection, deadline, fetchImpl = fetch) {
  if (!['study_materials', 'announcements'].includes(collection)) throw Error('Unknown school feed');
  const out = [];
  let cursor = null;
  while (true) {
    if (Date.now() >= deadline) throw Error('School feed exceeded the polling time budget');
    const url = new URL('/rest/v1/' + collection, SUPABASE_PROJECT_URL);
    url.searchParams.set('select', '*');
    url.searchParams.set('published', 'eq.true');
    url.searchParams.set('archived_at', 'is.null');
    url.searchParams.set('order', 'id.asc');
    url.searchParams.set('limit', '500');
    // Quote PostgREST filter values, including punctuation in imported IDs.
    if (cursor !== null) url.searchParams.set('id', 'gt.' + JSON.stringify(cursor));
    const response = await fetchImpl(url, {
      headers: {apikey: SUPABASE_PUBLISHABLE_KEY, Accept: 'application/json'},
      cache: 'no-store', signal: AbortSignal.timeout(Math.max(1, Math.min(12000, deadline - Date.now())))
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw Error('School feed returned HTTP ' + response.status);
    }
    const rows = await response.json();
    if (!Array.isArray(rows)) throw Error('School feed returned an invalid response');
    for (const row of rows) {
      // Filter again at the boundary, even when the upstream policy changes.
      if (!row || row.published !== true || row.archived_at || !row.id) continue;
      if (collection === 'study_materials' && !row.pdf_url) continue;
      const raw = collection === 'announcements' ? normalizeSupabaseAnnouncement(row) : row;
      const source = collection === 'study_materials' ? 'pdf' : 'announcement';
      const title = cleanSchoolText(raw.title || 'School update').slice(0, 180);
      const body = cleanSchoolText(raw.message || raw.description || raw.subject || 'New school material').slice(0, 220);
      const is_test = source === 'pdf' ? classifyTestPdf(raw).isTest : isTestNotice(raw);
      const fingerprint = await sha(JSON.stringify([title, body, raw.pdf_url || raw.attachmentUrl || '', raw.eventDate || '']));
      const id = String(row.id);
      out.push({id: source + ':' + id + ':' + fingerprint.slice(0, 24), source, source_id: id, title, body,
        path: source === 'pdf' ? (is_test ? '/tests' : '/pdf-explorer') : '/school-reminders?message=' + encodeURIComponent(id), is_test});
      if (out.length > 10000) throw Error('School feed is too large for one atomic poll');
    }
    if (rows.length < 500) return out;
    const next = String(rows.at(-1)?.id || '');
    if (!next || next === cursor) throw Error('School feed pagination did not advance');
    cursor = next;
  }
}
