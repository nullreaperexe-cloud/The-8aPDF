# School background notifications

`school-push` runs in the existing Supabase project. A database Cron job invokes it every ten minutes, even when no browser is open. It reads the existing public Firestore school feeds. Initial records become a baseline and are never broadcast as new content; later records and content changes create deduplicated delivery entries.

Subscriptions are opt-in and bound to the verified Supabase user session. Only the owning session can test or remove its subscription. Endpoint hosts and encryption keys are validated. The public GET response contains the VAPID public key and last-check time. All mutation routes validate the user's JWT; the scheduled polling route requires a separate secret stored in Vault. The function intentionally performs its own authentication with gateway JWT verification disabled.

The five `school_push_*` tables have RLS enabled and no browser-role privileges. The service-role function alone reads configuration, subscriptions and delivery records. The VAPID private key and worker secret are backend configuration and must never be committed. Preserve the existing VAPID key pair when deploying a new function version, otherwise existing subscriptions need to be renewed.

Deploy `supabase/functions/school-push/index.ts` with its `deno.json` and two shared-module copies. The test suite verifies the copies remain identical to `shared/`. Apply the schema and configure one stable VAPID key pair plus a random worker secret in `school_push_config`; store that worker secret in Vault as `8apdf_school_push_worker`. `db/school-push-cron.sql` installs or updates the scheduled job.

Successful pushes mark delivery rows sent; temporary failures retry with bounded backoff. Expired 404/410 endpoints are removed. Groups of updates are combined into a compact notification with a stable tag. `school-worker.js` displays the OS notification and opens the appropriate test/PDF/message view. It does not cache the app shell, so deploys cannot be trapped behind stale HTML.

The phone user must allow notifications once. On iPhone/iPad, install the site on the Home Screen and enable from that installed app. Browser/OS permission, connectivity and battery settings determine actual device delivery. No chat messages are sent by this school notification worker.

## Feed availability

School push depends on the existing AcademyVault Firestore feed being available. HTTP 429 RESOURCE_EXHAUSTED pauses new-event ingestion; the scheduled worker keeps retrying every ten minutes and preserves its deduplication baseline and pending deliveries. The notification settings show a delayed-feed notice after 25 minutes without a successful source check. No billing or upstream quota settings are changed automatically. The existing source currently returned quota-exceeded responses during final verification; native phone receipt still requires permission and the device test button.

## Reliability upgrade (2026-10-15)

Apply `db/school-push-reliability.sql` before deploying the updated function. It adds an owned lease and the service-role-only `school_push_ingest` RPC for atomic baseline/event/delivery ingestion. The `sync` action verifies the existing Firebase sync administrator's ID token; `FIREBASE_SYNC_EMAIL` optionally overrides the existing default email. The ten-minute Cron poll remains the fallback.

The active service worker is `sw.js`; `school-worker.js` loads it for old registrations. The frontend preserves explicit device opt-out. The backend uses cursor-pagination, joins each due row to its subscription, checks mutation errors, respects Retry-After and persists terminal failures. See `docs/cross-repo-audit.md` for evidence and limits. Run backend tests with `deno test --allow-env --config deno.json index_test.ts` from the function directory; HTTP dependencies are mocked, so no live push is sent.
