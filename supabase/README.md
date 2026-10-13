# School background notifications

`school-push` runs in the existing Supabase project. A database Cron job invokes it every ten minutes, even when no browser is open. It reads the existing public Firestore school feeds. Initial records become a baseline and are never broadcast as new content; later records and content changes create deduplicated delivery entries.

Subscriptions are opt-in and bound to the verified Supabase user session. Only the owning session can test or remove its subscription. Endpoint hosts and encryption keys are validated. The public GET response contains the VAPID public key and last-check time. All mutation routes validate the user's JWT; the scheduled polling route requires a separate secret stored in Vault. The function intentionally performs its own authentication with gateway JWT verification disabled.

The five `school_push_*` tables have RLS enabled and no browser-role privileges. The service-role function alone reads configuration, subscriptions and delivery records. The VAPID private key and worker secret are backend configuration and must never be committed. Preserve the existing VAPID key pair when deploying a new function version, otherwise existing subscriptions need to be renewed.

Deploy `supabase/functions/school-push/index.ts` with its `deno.json` and two shared-module copies. The test suite verifies the copies remain identical to `shared/`. Apply the schema and configure one stable VAPID key pair plus a random worker secret in `school_push_config`; store that worker secret in Vault as `8apdf_school_push_worker`. `db/school-push-cron.sql` installs or updates the scheduled job.

Successful pushes mark delivery rows sent; temporary failures retry with bounded backoff. Expired 404/410 endpoints are removed. Groups of updates are combined into a compact notification with a stable tag. `school-worker.js` displays the OS notification and opens the appropriate test/PDF/message view. It does not cache the app shell, so deploys cannot be trapped behind stale HTML.

The phone user must allow notifications once. On iPhone/iPad, install the site on the Home Screen and enable from that installed app. Browser/OS permission, connectivity and battery settings determine actual device delivery. No chat messages are sent by this school notification worker.
