# EduSecure → 8aPDF reliability and background push review

Reviewed repositories: `nullreaperexe-cloud/edusecure-pdf-sync` and `nullreaperexe-cloud/The-8aPDF`.

## Confirmed findings and repairs

| Finding | Repair |
|---|---|
| Alternate `https://the-8apdf.vercel.app` origin missing from the push CORS allowlist | Allow both known origin names, retaining exact-match validation. The verified live origin is 8apdf.vercel.app. |
| Random PDF document IDs duplicate writes after an ambiguous timeout | Create by SHA-256 of the canonical PDF URL; verify conflicts against the saved URL. |
| Lowercasing an entire URL merges case-sensitive paths and signed tokens | Normalize only the scheme and host; preserve path/query case. |
| Same date/title/subject used to suppress or delete different PDFs | Only exact URL identity confirms a PDF duplicate. |
| Incremental cache updates reset the full-refresh timer indefinitely | Keep the original refresh timestamp when appending newly published items. |
| Firestore 429 returned exit code 0 | Report `deferred`, return 75 and retain next-cycle handoff. |
| HTTP-only retries missed connection errors and timeouts | Shared bounded retries cover transport failures, transient statuses and Retry-After, with jitter. |
| Streamed PDF responses remained open on oversize/error exits | Close the response in a finally block. |
| Early authentication/driver failures could miss diagnostics | Atomic reports capture startup failures and interrupted cycles; browser cleanup runs in finally. |
| Sync unnecessarily opened a second browser for advisory dates | Live hostname is configurable; visual date audit is opt-in; Firestore remains authoritative. |
| Workflow handoff failed on a transient GitHub HTTP error | Retry dispatch, cap cycle/run duration and put the report in the Actions summary. |
| Push event insertion and delivery fan-out were separate transactions | `school_push_ingest` commits events, matching subscriptions and feed state atomically. |
| Push reads silently truncated feeds and subscribers at 1,000 | Cursor-pagination for Firestore and direct subscription joins for due deliveries. |
| Push sends could outlive the lease; old invocations could release a new lease | Unique lease owner, bounded four-worker fan-out, time budget and conditional release. |
| Push mutation errors were ignored; retries omitted diagnostic details | Check database errors, honor Retry-After, retain attempts/last_error and remove expired endpoints. |
| Granted browser permission caused automatic re-subscription after opt-out | Persist explicit opt-out, restore existing subscriptions only and guard concurrent restore/disable. |
| Invalid push URLs threw before notification handling; click depended on a loaded SPA bridge | Safe URL fallback and native navigation of an existing or new window. |
| Notification health was cached for the page lifetime | Read current backend health when refreshing settings. |
| Legacy study-materials storage allowed public upload, overwrite and delete | Remove the public ALL policy; backend service-role writes remain the authorized path. |
| PDF download used the old absolute deployment hostname | Use `/api/download` on the current origin. |

## Text corrections

- `– Regarding Short Leaves From` → `Regarding Short Leaves`. The previous rule missed Unicode dash prefixes. Internal phrases such as `Letter From Principal` remain intact.
- `All conversations marked read` → `All conversations marked as read`.
- `Mark all conversations read` → `Mark all conversations as read`.
- A deferred announcement no longer incorrectly claims that AI metadata is always the cause; quota deferral uses the same status.
- Firebase authentication, notification failures and recovery messages use complete, actionable sentences.
- Notification help now describes the sync-triggered check and the existing ten-minute scheduled fallback accurately.

These are deterministic formatting/grammar repairs. Teacher-authored multilingual source messages and historical facts are not freely rewritten or replaced with invented AI content. Existing historical cleanup uses the same safe title sanitizer on its next scheduled run.

## Actual implementation files

- `sw.js`: complete native-push service worker, notification click handling and subscription-change signal.
- `school-worker.js`: compatibility loader for existing registered workers.
- `push-notifications.js`: complete permission, subscription, session-authenticated API, preference and opt-out lifecycle.
- `supabase/functions/school-push/index.ts`: complete backend using web-push 3.6.7 and Supabase JS 2.58.0.
- `db/school-push-reliability.sql`: additive SQL upgrade for the transactional queue and owned lease.
- `db/storage-study-materials-policy.sql`: legacy storage write restriction.
- In the sync repository: `runner.py`, `sync_repair.py`, `reliable_http.py`, `push_bridge.py`, `pdf_integrity.py`, `announcement_processor.py`, `title_cleaner.py` and `.github/workflows/sync.yml`.

## Deployment and configuration

The existing Supabase backend is retained; no second database or Firebase Messaging project is needed. The existing VAPID key pair must be preserved. Do not generate a replacement pair during routine deployment.

1. Apply `db/school-push-reliability.sql` to the existing schema.
2. Deploy `school-push` with `index.ts`, `deno.json`, `push-policy.js` and `test-recognition.js`. Specify `deno.json` as the import map. Gateway JWT verification stays disabled because the function independently verifies browser JWTs, the Cron worker secret, or the Firebase sync administrator, depending on the route.
3. Deploy the website, including both service-worker paths and the no-cache headers in `vercel.json`.
4. Deploy the sync changes. `push_bridge.py` uses the existing Firebase ID token, validated by Google's account lookup endpoint and restricted to the existing sync administrator. No new GitHub secret is required with the existing default administrator. If `FIREBASE_ADMIN_EMAIL` is customized, set backend `FIREBASE_SYNC_EMAIL` to the same address.
5. Preserve the existing Cron job and Vault worker secret as the independent ten-minute fallback.

The backend SQL upgrade, backend version 8 and storage policy restriction were applied during this review. The live worker dry-run read 153 PDFs and 91 published announcements successfully. The website and sync changes were merged in The-8aPDF PR #6 and edusecure-pdf-sync PR #3. Both GitHub check suites passed; both Vercel deployment statuses reported success. The actual public site is https://8apdf.vercel.app/; the remembered the-8apdf.vercel.app hostname currently returns DEPLOYMENT_NOT_FOUND.

Frontend entry points, called from an actual button click:

```js
await window.__8apdfPush.enable();
await window.__8apdfPush.savePreferences({pdfs:true,announcements:true,testsOnly:false});
await window.__8apdfPush.test();
await window.__8apdfPush.disable();
```

The worker sends only after Firestore publication is confirmed. Its authenticated sync route re-reads the feed rather than accepting arbitrary notification text from callers. Updates are deduplicated and preference-filtered. Temporary delivery failures persist in PostgreSQL for later retries; 404/410 endpoints are removed.

## Verification evidence

- 49 Python tests passed, including transport timeout/retry exhaustion, deterministic PDF identity, case-sensitive URLs, distinct PDFs with identical metadata, stream cleanup, cache refresh age, authentication failure reporting and the Unicode grammar regression.
- Existing website test suite passed, plus real service-worker execution in a VM and actual frontend lifecycle tests for permission/subscription/opt-out behaviour.
- Five backend handler tests passed with real Web Push encryption and mocked HTTP boundaries: 1,001-record pagination, transactional RPC usage, failure visibility, Retry-After delivery retry, expiry removal, CORS and administrator-only trigger authentication.
- Deno type-check passed for the backend and its tests.
- Live PostgreSQL rollback test passed for baseline suppression, atomic ingestion, duplicate suppression, subscription fan-out, lease exclusion and browser-role RPC denial. No synthetic test event or notification was committed.
- Live CORS preflight: 200 for the alternate allowed origin; the current 8apdf.vercel.app origin was already allowed.
- Unauthenticated sync trigger: 401. Malformed payload: 400. Public health: 200.
- Live dry-run: 200; 153 PDF records and 91 published announcement records read.
- Legacy storage inspection now shows only the public SELECT policy for study-materials.

## Practical limits and remaining checks

A push provider's accepted response is not proof that the phone displayed the alert. Final native receipt must be checked on the user's opted-in device. On iOS/iPadOS 16.4+, the user must install the site on the Home Screen and grant notification permission from that app. Android/browser permissions, connectivity, battery restrictions and force-stop behaviour also affect delivery.

Retries provide at-least-once processing. A crash between a provider accepting a message and the database recording success can cause a repeat; stable notification tags reduce duplicate visible alerts. Failed deliveries after six attempts remain stored with `last_error` for operator review. The bounded worker drains up to 200 due delivery rows per invocation; very large backlogs need additional invocations. Feeds above 10,000 records fail explicitly rather than being truncated; partition or incrementally ingest them before that scale.

The scheduled GitHub sync continues to depend on Actions availability and the upstream EduSecure/Firestore services; no implementation can guarantee their uptime. Actual authenticated school login/upload execution cannot be reproduced locally without the existing GitHub secrets. The merged sync workflow is queued behind the existing worker; local tests do not prove that live cycle has completed. The connected Vercel account returns 403 for this team, so dashboard-level deployment/domain inspection is unavailable through that connection.

The Supabase advisor also reports existing chat SECURITY DEFINER functions, intentional anonymous chat access, the pg_net extension location and disabled leaked-password protection. These are separate from the push fixes and need contextual review; advisor warnings alone do not prove an exploitable defect. Push tables intentionally have RLS and no browser-role policies/privileges. See the [Supabase advisor guidance](https://supabase.com/docs/guides/database/database-linter).

## Rollback

Revert the website/sync commits to restore the prior code. Backend version 6 can be redeployed from the previous repository revision with its original four files and `deno.json` import map; the additive SQL columns/functions do not require dropping or recreating tables. Keep subscriptions and VAPID keys intact. Do not restore public storage write access as part of a code rollback.
