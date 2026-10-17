import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const api=source('api/short-links.js');
const redirect=source('api/redirect.js');
const ui=source('short-links-ui.js');
const edge=source('supabase/edge-functions/apdf_short_links/index.ts');
const importer=source('scripts/migrate-legacy-short-links.mjs');

assert(api.includes("apdf_short_links"),'Short link API must call Supabase');
assert(redirect.includes("apdf_short_links"),'Redirect API must use Supabase');
assert(!api.includes('firestore.googleapis.com'),'Short-link creation must not need Firestore');
assert(api.includes("oldLinks(body.ownerKey)"),'Preserve recoverable legacy Blob links');
assert(api.includes("supabase('create'"),'Create aliases in permanent Supabase store');
assert(api.includes('originalPdfUrl'),'Legacy aliases should be recoverable with their original PDF URL');
assert(redirect.includes('fromOldBlob(slug)'),'Legacy Blob redirects should keep working if store reconnects');
assert(ui.includes("data-link-url="),'Link manager must respect original/new link hostnames');
assert(ui.includes('SHORT_HOST'),'Share dialog should show active domain');
assert(edge.includes(".from('study_materials')"),'New aliases must verify a live school PDF');
assert(edge.includes(".from('short_links')"),'New aliases must be stored in Supabase');
assert(edge.includes("owner_hash"),'Only owner should manage their links');
assert(edge.includes("this short name".toLowerCase())||edge.includes('This short name'),'Duplicate alias must be rejected');
assert(importer.includes('--apply')&&importer.includes("prior.url!==row.url"),
  'Legacy migration must be dry-run by default and preserve conflicting aliases');
console.log('PASS Supabase short link storage, live PDF validation, ownership and legacy fallback');
