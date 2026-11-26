# Metadata and guest onboarding repair (review only)

## Confirmed data flow
Supabase study_materials -> supabase-materials.js / api/_supabase_materials.js -> features/app-core.js normalizeDoc() -> PDF cards, recent items, search/command results, share/download -> __8apdfStudyBridge.documents() -> PDF Explorer and AI Finder.

Before this branch, PDF cards cleaned only titles; descriptions and other views used raw data. The shared normalizer now creates consistent display metadata and preserves original source metadata, IDs, URLs and dates. It never writes back to Supabase.

## Missing upstream code
The actual EduSecure PDF importer, prompt and writer are NOT identified in this public repo. The existing EduSecure holiday-calendar workflow is unrelated. To fix recurring dirty imports, provide the worker/parser, sample source HTML/messages, title prompt, record write logic and anonymized before/after records. No importer filename or model training is invented.

## Evidence quality pipeline
- shared/title-clarity.js: source-backed title/description cleanup and review flags, conservative portal-chrome removal and filename fallback.
- shared/pdf-evidence.js: optional bounded explicit PDF.js read (up to 8 MiB, 3 pages); no automated bulk download, no OCR.
- api/pdf-metadata-suggest.js: optional secured admin POST; existing GROQ_API_KEY and ADMIN_API_TOKEN names, JSON validation, timeout, instance-local rate limit, deterministic fallback and NO database writes. Not invoked on ordinary search or card render.
- scripts/metadata-dry-run.mjs: read-only local JSON audit before any approved backfill.

Example: node scripts/metadata-dry-run.mjs ./export.json --output ./review.json

Export the original DB records, preserve existing raw/source/manual approvals, and review suggestions by ID. Any future backfill requires a separate migration with human approval and rollback from that export. Patch the actual importer before any backfill to prevent dirty values returning.

Scanned PDFs need an actual OCR worker such as Tesseract; this branch does NOT install OCR or incur its compute costs. AI suggestions require configured server-side GROQ_API_KEY and are not model weight training. Rate limits in a serverless instance are not globally enforced across instances.

## Optional guest state
8apdf_guest_browse_v1 marks anonymous browsing, not a named account. Guest skip bypasses first-paint name/welcome, subsequent music consent and optional permission prompts. A visitor can later set a name in Profile. Music skip uses 8apdf_music_deferred_v1 without pretending they chose No Music. Existing selections remain intact.

If both localStorage and sessionStorage are blocked, only in-memory skip is possible for the current page; persistence across reloads is impossible without storage.

## Tests and deployment
npm ci
node tests/metadata-clarity-v2.test.cjs
node tests/name-onboarding.test.cjs
node tests/music-choice.test.cjs
npm test
npx playwright install chromium
npm run test:onboarding:browser
npm run build:admin

Do not merge or deploy until the user approves. This branch contains no production DB writes, deployment or paid-service setup.

## Acceptance
- Meaningless identifiers become neutral or supported filename-based labels.
- A meaningful Class Test Circular remains intact.
- All metadata consumers use consistent normalized values with original source retained.
- Guest reload and music skip do not block the library.
- No surprise permissions, stuck inert siblings or scroll locks.
- Mobile/desktop layouts and disabled-storage behavior are reviewed.
