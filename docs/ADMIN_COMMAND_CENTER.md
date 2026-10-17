# 8aPDF Admin Command Center

Entry point: **https://the-8apdf.vercel.app/admin**. The existing `8apdf.vercel.app` address is retained on the same Vercel project. The public homepage is preserved.

## First administrator

`nullreaper.exe@gmail.com` is reserved for the first **Super Admin** in a private database allowlist. At `/admin`, choose **First-time setup**, create a strong password, confirm the email, then sign in. Enrollment checks the verified email in `auth.users` on the server and consumes the pending invitation. User-editable metadata never grants a role. Passwords are not supplied or stored in this repository.

Supabase Auth URL configuration was saved and verified in the signed-in dashboard:

- Site URL: `https://the-8apdf.vercel.app/admin`
- Allowed redirect URLs: `https://the-8apdf.vercel.app/admin` and `https://8apdf.vercel.app/admin`
- Dashboard: https://supabase.com/dashboard/project/xudhjwojgxblbsebkzso/auth/url-configuration

The server-side minimum password length is set to 12 characters. Mail delivery and the owner’s first verification interaction still require the owner’s mailbox.

Only the project owner can add other administrators. Create/verify their Supabase Auth account, then insert the approved UUID into `public.admin_users` with `role='admin'` or `role='super_admin'`. Setting `enabled=false` takes effect on the next API request. No public self-promotion or browser write policies exist.

## Implementation

| Files | Purpose |
| --- | --- |
| `admin.html`, `admin/admin.css` | Separate responsive graphite/ivory dashboard; mobile drawer, accessible forms/dialogs, light theme, reduced motion |
| `admin/main.js`, `admin/client.js`, `admin/domain.js` | Management UI, Auth session refresh/logout, real upload progress, server/client validation helpers, duplicate detection |
| `admin/admin.bundle.js` | Committed ~76 KB isolated bundle with local Lucide icons; no service credentials |
| `supabase/functions/admin-command/index.ts`, `supabase/config.toml` | Protected Edge API with live session/role checks, bounded uploads, checksum/public URL verification and durable recovery |
| `supabase/migrations/*admin*.sql` | Additive schema, RLS, private allowlist, transactional mutations/audit, optimistic versions, safe link/file guards |
| `supabase-announcements.js` | Explicit admin edits override legacy display fields while original `raw` data remains preserved |
| `index.html` | Three-line event integration to refresh already-open student tabs after a save; existing polling and school-date sorting retained |
| `vercel.json` | `/admin` routing ahead of slug redirects, no-store and security headers |
| `scripts/migrate-legacy-short-links.mjs` | Trusted service-role legacy import marker; historical aliases can retain missing original document IDs without granting public writes |

The unused Node `firebase-admin` dependency was removed after checking the repository has no imports. Browser Firebase/chat code is unchanged. Existing Vercel APIs and EduSecure Edge Functions remain in place.

## Applied migrations

1. `20261017070929_admin_command_center.sql`
2. `20261017072404_admin_conflict_responses.sql`
3. `20261017072815_admin_preserve_sync_and_link_transfer.sql`
4. `20261017073315_admin_preserve_legacy_import.sql`

Original PDF/announcement IDs, timestamps and `raw` metadata are retained. New records receive a real `inserted_at`; historical records retain a nullable insertion time and are clearly labelled as inferred. The original `UNIQUE(pdf_url)` constraint is retained for automation compatibility. Intentional reference copies add a fragment to the same file URL; canonical duplicate detection ignores fragments while preserving path case and query parameters.

## Security and recovery

- Every Edge request validates its access token with Supabase Auth, then verifies the live `auth.sessions` row and an enabled database role. Revoked/expired sessions are denied. The Edge gateway verifier is intentionally off because the handler performs these stronger checks itself.
- The service-role credential stays inside Supabase's server environment. The browser stores only its own Auth session in session storage; the publishable key is public by design.
- RLS exposes only published, unarchived catalogue rows. Browser roles have no direct content, role, audit, short-link or Storage write privileges.
- Writes are field-validated and version-checked. Database mutations and audit events share a transaction. SQL identifiers are allowlisted and quoted. Displayed user text is escaped.
- Each admin is limited to 90 requests/minute. Supabase Auth also supplies its own sign-in/email rate limits.
- PDFs require `.pdf`, `application/pdf`, a PDF signature, an EOF marker and at most **20 MB** on the server. Document bytes are preserved; names appearing in PDF text, metadata or streams do not cause rejection. No malware-scanner certification is claimed.
- Uploads use UUID paths without upserts, SHA-256 checksums, a real public-file verification request, and durable upload records. A failed DB/Storage operation retains recovery information; retries reuse the same UUID. Announcement create requests and attachment retries also have stable request IDs.
- PDF contents have a persistent SHA-256 identity in `admin_pdf_assets`, independent of library records. Re-adding deleted content reuses its original URL and physical object, including renamed files. Upload request UUIDs remain independent for retry recovery. Existing short URLs are returned and detached aliases are reattached to a published replacement record without changing their destination, owner, title or creation time; a new requested slug is ignored when a retained alias already exists. Deleted hosted objects can be recreated at their original path on a later upload.
- **Upload PDFs → Use an Image2URL PDF link** is an optional alternative to choosing a file. The server downloads and validates a public HTTPS PDF (maximum 20 MB) from Image2URL before saving. Redirects stay on Image2URL; private/lookalike hosts and non-PDF responses are rejected. External PDFs retain their Image2URL destination and require no Supabase object. Identical content uses the first registered destination regardless of later input method. An existing active entry still requires explicit duplicate opt-in.
- Archive is reversible and retains the prior publication state. Permanent deletion works directly for active or archived PDFs and announcements, requiring Super Admin and typed confirmation. PDF deletion detaches its short URLs without changing their slug, destination, owner or creation time. Deleted metadata is retained in a server-only recovery snapshot. Files stay hosted until separately deleted.
- **Link Manager → Short URLs** lists every saved alias, including aliases whose library record was deleted. Delete an alias here to stop that short URL only. **Link Manager → Supabase PDF URLs** lists the actual `study-pdfs` bucket inventory, including files without a surviving catalogue record or tracked upload job. It shows complete file URLs, sizes and reference counts, with copy, open and separate file deletion controls. Remove library and short-URL references before deleting the physical file.
- Link transfers preserve the exact shared destination; only a compatible record association changes. A file cannot be removed while any PDF (including archived PDFs), announcement or short link still references it.
- Source automation cannot overwrite protected admin-edited fields, original creation time or legacy `raw` keys. No automation credentials or code were changed.

## Verification

```sh
npm ci
npm run build:admin
npm test
npm run test:admin
npx deno@2.5.4 check --node-modules-dir=auto --no-lock supabase/functions/admin-command/index.ts
npm run dev:admin
```

Live tests are **opt-in**, use isolated authentication identities, and clean up only their own temporary records/files/aliases:

- `tests/prepare-admin-live.mjs`: generates private, git-ignored fixture credentials and owner-applied SQL.
- `tests/admin-live.mjs`: real Auth/RLS, PDF upload/public URL, retry, duplicate warnings, source-independent links, browser ownership, destination-preserving transfers, edits/concurrency, announcements/attachments, archive/restore/delete, batch results and file-reference guards.
- `tests/admin-delete-browser.mjs`: real row-menu and batch deletion of active PDFs and announcements, typed confirmation, cancellation and removal from public listings. Uses isolated fixtures and retains shared files.
- `tests/admin-link-lifecycle.mjs`: a real hosted PDF, short redirect and announcement attachment survive catalogue deletion; Link Manager lists them, removes the alias separately, and removes the file only after explicit file deletion. Includes anonymous access checks, reference counts and phone layout.
- `tests/admin-upload-reuse.mjs`: renamed-file re-upload, original URL/alias preservation, retry recovery, one physical inventory entry, optional Image2URL form without a file, and reuse across file/link input methods. `tests/admin-assets-rollback.sql` checks canonical reservations, alias ownership and nullable external storage paths inside a rolled-back transaction.
- `tests/admin-browser.mjs`: actual browser login and forms, all nine sections, responsive 1440/820/390px layouts, search/sort, upload/publication/custom slug, announcements, themes, reduced motion, logout and Access Denied. `ADMIN_BASE_URL` selects the target; default is local.
- `tests/admin-database-rollback.sql`: service-role permissions, revoked sessions, rate limits, draft restoration, idempotent archive/restore, sync preservation and safe transfer/deletion, rolled back in PostgreSQL.
- `tests/cleanup-admin-live.mjs`: recovery cleanup scoped to the isolated fixture identity and unique suffix after a network interruption.

Baseline preserved inventory: **40 PDFs, 97 announcements, one historical Supabase short link**. Temporary test content is removed after verification. Audit events remain evidence of the test actions.

## Explicit limits

- Public Storage URLs are permanent public files, including drafts; unpublishing/archiving removes a catalogue listing and does not revoke a previously shared file URL.
- External-host availability is not fetched through a generic server proxy. Link health verifies the live record association and checks HTTP availability for this project's own Storage; other hosts are labelled unverified and can be opened manually.
- Storage usage reports tracked admin uploads, not the size of externally hosted school PDFs. Existing sync-error telemetry is unavailable and is labelled accordingly.
- Some legacy timestamps are missing or reflect import time; original priority is inferred for those records.
- The original Vercel Blob credentials/store were not available to this session. No historical Blob import is claimed. The existing non-overwriting importer and redirect fallback remain available when the original store is connected.
- Supabase's advisor reported leaked-password protection disabled. Enabling it depends on the project's Auth configuration/plan; no paid service was added.
- Email delivery and the owner’s first verification/recovery interaction require the owner’s mailbox. Those are not represented as completed automated checks.
