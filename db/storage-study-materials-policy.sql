-- The current app reads legacy PDFs here; all live sync writes use Firestore.
-- Unauthenticated visitors must not be able to upload, replace or delete PDFs.
-- Backend service-role writes use their existing RLS bypass.
begin;
drop policy if exists "Unrestricted Management Access" on storage.objects;
commit;
