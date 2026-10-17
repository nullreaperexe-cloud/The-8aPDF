export const MAX_PDF_BYTES = 20 * 1024 * 1024;
export const PUBLIC_ORIGIN = 'https://the-8apdf.vercel.app';
export const RESERVED_SLUGS = new Set('api app admin about help privacy terms settings home index login logout register signup dashboard library chatbot timetable updates tasks pdfs classic announcement announcements pdf share short download manifest favicon robots sitemap assets static public support contact status vercel www database live-database chat school-calendar school-reminders my-short-links important-messages notification-settings pdf-explorer'.split(' '));
/** @returns {never} */
export function fail(message, status = 422) { throw Object.assign(new Error(message), { status }); }
export function httpsURL(value) {
  try {
    const u = new URL(String(value || ''));
    if (u.protocol !== 'https:' || u.username || u.password || !u.hostname.includes('.') || /^(localhost|.*\.local|127\.|10\.|192\.168\.|169\.254\.|0\.)/i.test(u.hostname) || /^172\.(1[6-9]|2\d|3[01])\./.test(u.hostname) || u.hostname.includes(':')) return null;
    return u.href;
  } catch { return null; }
}
export function canonicalURL(value) {
  const valid = httpsURL(value);
  if (!valid) return null;
  const u = new URL(valid); u.hash = ''; // Path case and query parameters remain significant.
  return u.href;
}
export function validSlug(value) {
  const slug = String(value || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(slug) || slug.includes('--') || RESERVED_SLUGS.has(slug)) fail('Use an available name with 3–32 letters, numbers or single hyphens.');
  return slug;
}
export function cleanText(v, name, max, required = false) {
  if (typeof v !== 'string') fail(`${name} must be text.`);
  const s = v.trim();
  if ((required && !s) || s.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s)) fail(`${name} must contain ${required ? '1' : '0'}–${max} valid characters.`);
  return s;
}
export function dateValue(v, name) {
  if (v === null || v === '') return null;
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(v) || !Number.isFinite(Date.parse(v))) fail(`${name} must be a valid ISO date.`);
  const iso = new Date(v).toISOString();
  if (iso.slice(0, 10) !== v.slice(0, 10)) fail(`${name} is not a calendar date.`);
  return iso;
}
export function metadata(table, input, partial = false) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('Metadata must be an object.');
  const pdf = table === 'study_materials';
  if (!pdf && table !== 'announcements') fail('Unsupported collection.');
  const fields = pdf ? { title: 500, description: 10000, subject: 120, chapter: 200, class_name: 80, term: 80, source: 80 } : { title: 500, description: 10000, subject: 120, category: 120, original_message: 40000, priority: 20 };
  const out = {};
  for (const [k, max] of Object.entries(fields)) if (Object.hasOwn(input, k)) out[k] = cleanText(input[k], k, max, k === 'title');
  if (!partial && !out.title) fail('Title is required.');
  if (Object.hasOwn(input, 'published')) { if (typeof input.published !== 'boolean') fail('Publication status must be true or false.'); out.published = input.published; }
  const dk = pdf ? 'source_date' : 'message_date';
  if (Object.hasOwn(input, dk)) out[dk] = dateValue(input[dk], dk);
  if (pdf && Object.hasOwn(input, 'tags')) {
    if (!Array.isArray(input.tags) || input.tags.length > 30) fail('Use up to 30 tags.');
    out.tags = input.tags.map(t => cleanText(t, 'Tag', 60, true));
  }
  if (!pdf && out.priority && !['low', 'normal', 'high', 'urgent'].includes(out.priority)) fail('Choose low, normal, high or urgent priority.');
  if (!pdf && Object.hasOwn(input, 'attachment_url')) { if (input.attachment_url && !httpsURL(input.attachment_url)) fail('Attachment URL must be a safe HTTPS URL.'); out.attachment_url = input.attachment_url || null; out.has_attachment = !!out.attachment_url; }
  if (pdf && Object.hasOwn(input, 'pdf_url')) { if (!httpsURL(input.pdf_url)) fail('PDF URL must be a safe HTTPS URL.'); out.pdf_url = httpsURL(input.pdf_url); }
  return out;
}
export async function validatePDF(file) {
  if (!file || typeof file.arrayBuffer !== 'function' || !/\.pdf$/i.test(file.name) || file.type !== 'application/pdf') fail('Choose a PDF file (.pdf, application/pdf).');
  if (!file.size || file.size > MAX_PDF_BYTES) fail('PDF must be between 1 byte and 20 MB.', 413);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const decoder = new TextDecoder('latin1');
  if (!decoder.decode(bytes.subarray(0, 8)).startsWith('%PDF-') || !decoder.decode(bytes.subarray(Math.max(0, bytes.length - 2048))).includes('%%EOF')) fail('The file is not a complete PDF. Export it as a PDF and try again.');
  if (/\/(?:JavaScript|JS|Launch|EmbeddedFile)\b/.test(decoder.decode(bytes))) fail('Active scripts, launch actions and embedded files are not accepted in school PDFs.');
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return { bytes, checksum: Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join(''), filename: file.name.replace(/[\\/\u0000-\u001f]/g, '_').slice(0, 240) };
}
function insertion(r) { return Date.parse(r.inserted_at || r.created_at || '') || 0; }
export function duplicateGroups(records, strictness = 'balanced') {
  const groups = [], buckets = new Map(), parent = new Map(records.map(r => [r.id, r.id]));
  const find = id => { let root = id; while (parent.get(root) !== root) root = parent.get(root); while (id !== root) { const next = parent.get(id); parent.set(id, root); id = next; } return root; };
  for (const r of records) for (const key of [canonicalURL(r.pdf_url) && 'url:' + canonicalURL(r.pdf_url), r.file_checksum && 'sha:' + r.file_checksum, r.storage_path && 'storage:' + r.storage_path].filter(Boolean)) {
    if (buckets.has(key)) parent.set(find(r.id), find(buckets.get(key))); else buckets.set(key, r.id);
  }
  const exact = new Map();
  for (const r of records) { const key = find(r.id); if (!exact.has(key)) exact.set(key, []); exact.get(key).push(r); }
  const sort = rows => [...rows].sort((a, b) => insertion(a) - insertion(b) || a.id.localeCompare(b.id));
  for (const rows of exact.values()) if (rows.length > 1) {
    const ordered = sort(rows), checksums = new Set(rows.map(r => r.file_checksum).filter(Boolean));
    groups.push({ id: ordered.map(r => r.id).sort().join('|'), confidence: 'confirmed', reason: checksums.size === 1 && rows.every(r => r.file_checksum) ? 'Identical SHA-256 file content' : 'Same saved URL or storage object', inferred: rows.some(r => !r.inserted_at), records: ordered });
  }
  if (strictness === 'exact') return groups;
  const tokens = r => new Set(String(r.title || '').toLowerCase().match(/[\p{L}\p{N}]+/gu) || []);
  const contexts = new Map();
  for (const r of records) {
    const context = [String(r.subject || '').toLowerCase(), String(r.chapter || '').toLowerCase(), String(r.source_date || r.date_iso || '').slice(0, 10)].join('|');
    if (!contexts.has(context)) contexts.set(context, []);
    const list = contexts.get(context), a = tokens(r);
    for (const prev of list) {
      if (find(r.id) === find(prev.id)) continue;
      const b = tokens(prev), union = new Set([...a, ...b]), intersection = [...a].filter(t => b.has(t)).length;
      const score = union.size ? intersection / union.size : 0;
      if (a.size >= 3 && score >= (strictness === 'broad' ? .65 : .8)) {
        const ordered = sort([prev, r]);
        groups.push({ id: ordered.map(x => x.id).sort().join('|'), confidence: score >= .95 && r.subject && r.chapter && r.source_date ? 'probable' : 'possible', reason: `Similar metadata (${Math.round(score * 100)}% title overlap); file content not verified`, inferred: ordered.some(x => !x.inserted_at), records: ordered });
      }
    }
    list.push(r);
  }
  return groups;
}
