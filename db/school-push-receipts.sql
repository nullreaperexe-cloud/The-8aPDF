-- Push-provider acceptance is distinct from browser notification display.
-- These fields remain inside the existing service-role-only queue.
begin;
alter table public.school_push_deliveries
 add column if not exists receipt_id uuid,
 add column if not exists provider_accepted_at timestamptz,
 add column if not exists push_received_at timestamptz,
 add column if not exists notification_shown_at timestamptz,
 add column if not exists receipt_error text,
 add column if not exists worker_version text;
create index if not exists school_push_deliveries_receipt_idx
 on public.school_push_deliveries(subscription_id,receipt_id) where receipt_id is not null;
commit;
