8aPDF Workspace Upgrade v4
==========================
Repository: nullreaperexe-cloud/The-8aPDF
This is an additive New Workspace enhancement. Classic UI remains unchanged.

New sidebar: PDF/teacher checklist + custom to-dos, PDF ZIP, 6 locally generated ambient sounds, full-file sharing, authenticated PDF upload with public redirect link, editable home widgets.
New welcome: improved mobile heading; desktop preserves the existing premium animations.
Settings: device dark/light/system, boost low-end devices, original motion preference, clear temporary cache. Existing Liquid Glass customization is bypassed in New Workspace.
Summaries: client extracts up to 12 PDF pages; server sends limited text to Gemini 2.5 Flash Lite via /api/pdf-summarize. Scanned PDFs cannot be read without OCR.
Upload endpoint: /api/upload-pdf validates PDF magic bytes and max 4 MB and stores PDF + short-link record in Vercel Blob. An authorization code is required to avoid unauthenticated public storage abuse.

DEPLOYMENT REQUIREMENTS (VERCEL SETTINGS, NOT JUST GITHUB ACTIONS SECRETS):
1. GEMINI_API_KEY – used by /api/pdf-summarize.js (required for real AI summaries).
2. BLOB_READ_WRITE_TOKEN – storage token obtained by linking Vercel Blob store to the 8apdf project. Also required by existing /api/short-links.
3. PDF_UPLOAD_TOKEN – choose a long random private code. Only students/admins with this code can publish PDFs via Upload & Public Short Link. Do not commit this secret.

Known limitations / transparent notes:
- Live Gemini, Firestore permissions, Blob upload, short-link redirects and deployment cannot be verified without authorized Vercel project access/network.
- A GitHub Actions secret GEMINI_API_KEY by itself does not automatically become a Vercel environment variable.
- To-do and widget preferences are saved in this browser using localStorage, not cross-device synchronized.
- The Vercel serverless upload body size cap is 4 MB. PDF >4 MB should be hosted elsewhere or a secure Vercel Blob client-upload workflow added later.
- A host/browser must allow native Web Share API for full-file manual sharing; fallback message explains incompatibility.
- ZIP packing is constrained by safe browser memory, so it reports how many PDFs actually made it into the archive.
- Original features and animations still run, aside from intentional Studio-only removal of glass/glow and user-selected performance boost.

Tests:
- node --check for API and new JS
- Playwright interaction fixture: 1440px desktop, 390px mobile, 320px small phone passed
- Real production end-to-end tests pending Vercel access and environment configuration.