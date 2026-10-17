# School background notifications

The `school-push` Edge Function and its durable queue remain in AcademyVault
(`uumqvvsfqwpwtwerdylv`), alongside existing phone subscriptions and chat
identities. It reads the **current** website catalogue in the 8aPDF project
(`xudhjwojgxblbsebkzso`), using its public, read-only RLS policies. Firestore is
no longer a school notification source.

Database Cron calls the worker **every minute**, whether or not anyone has the
website open. It reads published, unarchived PDFs and announcements with keyset
pagination, normalizes announcement edits like the website, and atomically
creates deduplicated events and per-device deliveries. Content edits can notify;
display-order and timestamp changes alone do not.

## Deployment

1. Apply `db/school-push-supabase.sql` in the **push/AcademyVault project** after
   the existing `db/school-push.sql` and `db/school-push-reliability.sql` schema.
2. Deploy `supabase/functions/school-push/index.ts` with `deno.json`, `deno.lock`
   and every sibling JavaScript dependency. Catalogue-module copies must match
   their repository-root originals; `npm test` enforces this.
3. Invoke one authenticated poll to baseline the migrated catalogue. Each source
   tracks its feed revision, so migration never alerts users about historical
   content. Later publications and content changes enter the queue.
4. Apply `db/school-push-cron.sql` to update the existing named Cron job to one
   minute. Its worker secret stays in Vault as `8apdf_school_push_worker`.

Preserve the installed VAPID key pair, worker secret, subscriptions and delivery
history. Never commit private keys or service-role credentials. Gateway JWT
verification stays disabled because the function authenticates each action:
scheduler calls require the worker secret, and device actions require a verified
Supabase user session plus an allowed site origin. The legacy `sync` wake-up
verifies the existing Firebase administrator; scheduled delivery does not depend
on that administrator or an open admin panel.

Backend tables have RLS enabled and no browser-role privileges. Worker RPCs are
service-role-only and use invoker security. An owned lease excludes overlapping
workers. Temporary failures retry with bounded backoff and Retry-After support;
expired 404/410 subscriptions are removed. Content preferences and explicit
per-device opt-out are preserved.

## Phone setup and verification

Open `/notification-settings` once on each phone, choose **Enable on this device**
and grant permission. Android uses a supported browser. On iPhone/iPad with
iOS/iPadOS 16.4 or later, add 8aPDF to the Home Screen, open that installed app
and enable notifications there.

**Test after closing the website** stores a device-only test in the server queue
with a 30-second delay. Close all 8aPDF tabs; the next Cron run normally delivers
it in about 30–90 seconds. It needs no page timer or active tab. Explicit tests
bypass content-category filters, but disabling the device deletes its queued
deliveries. The ordinary test button still sends immediately.

`sw.js` displays the notification even with no open window and opens the relevant
PDF/test/announcement page when tapped. `school-worker.js` keeps old registrations
compatible. No app-shell caching is used.

Actual receipt depends on OS/browser permission, connectivity, Focus/battery
settings and push-service availability. A successful transport response means
the push service accepted the message, not proof a phone displayed it. Settings
reports a feed delay after five minutes without a successful catalogue check.

## Lock-screen delivery and receipts

Apply `db/school-push-receipts.sql` in the push project before deploying the
updated function. User-visible pushes request **high** urgency so a sleeping
phone need not wait for normal-priority maintenance windows. `sw.js` requests
non-silent alerts and retries with basic notification options if a browser
rejects optional vibration/presentation settings.

Queue rows distinguish `provider_accepted_at` from `push_received_at` and
`notification_shown_at`. A short, HMAC-signed token scopes the worker's
acknowledgement to one device and one delivery attempt for 48 hours. It works
without an open page or a login token and grants no subscription-management
access. Display acknowledgements reflect the browser notification API; phone
settings still determine lock-screen visibility. Failed reporting does not
prevent display. Settings never treats provider acceptance as proof of display.

After downloading the updated site once, **Repair this device** updates the
service worker and renews stale subscription material. Previously opted-in
devices with missing subscriptions also renew on their next visit. Explicit
opt-out and content preferences remain preserved.

On iPhone, allow Lock Screen alerts for the installed Home Screen app in iOS
notification settings. On Android, allow browser/site notifications on the
lock screen. Focus/Do Not Disturb, force-stopping the browser and device battery
restrictions are OS controls that website code cannot override.

## Checks

- `npm test`: client opt-out, closed-window service worker, current catalogue
  pagination, normalization, filtering, fingerprint stability and shared copies.
- `deno test --allow-env --config supabase/functions/school-push/deno.json supabase/functions/school-push/index_test.ts`:
  actual handler with mocked HTTP, encryption, retry, endpoint cleanup, ownership
  and delayed device-test delivery. No live phone receives test notifications.
- `tests/push-supabase-rollback.sql`: real database migration baseline, PDF and
  announcement fan-out, dedupe, atomic rollback, owner-only delayed tests and
  restricted RPC privileges. All test writes are rolled back.
