# Permanent 8aPDF short links (Supabase)

The 8aPDF short-link backend uses **the new 8aPDF Supabase project**
`xudhjwojgxblbsebkzso`, not Firebase or a newly connected Vercel Blob store.

## Live routing

- `GET /api/short-links?slug=joban`: check whether an alias is available.
- `POST /api/short-links`, `action=create`: validate the original PDF against `study_materials`, insert a permanent alias, and return the site's live URL.
- `POST /api/short-links`, `action=list`: list aliases owned by the browser's 64-hex secret, plus recoverable aliases in an available legacy Blob store.
- `POST /api/short-links`, `action=delete`: delete only an alias whose SHA-256 owner matches that browser secret.
- `GET /:slug`: redirect to the school's original PDF. **Original Vercel Blob first when connected**, then permanent Supabase, so existing old slugs cannot be hijacked.

`public.short_links` has unique slugs and RLS enabled, with **no public table read/write permissions**. The `apdf_short_links` Edge Function performs narrow validated operations with a server-held service-role credential. Never put a service-role key in browser JavaScript or GitHub source.

**Important domains:** New links generated from `the-8apdf.vercel.app` point to that active website, not automatically to the previous `8apdf.vercel.app` deployment. Legacy links keep their original URL and can be recovered under their original slug if the original Vercel store is accessible. Moving old production aliases between distinct Vercel projects needs control of their DNS/deployment configuration.

## Old aliases: what is and is not migrated

**The old Vercel Blob store is a separate remote service.** Replacing code does **not** copy the bytes or JSON objects previously stored there. When its `BLOB_READ_WRITE_TOKEN` still exists in Vercel's environment:
- The public redirect API tries to resolve old aliases from the original `short-links/v1/<slug>.json` Blob files.
- A browser opening **My Short Links** with the same preexisting ownership key attempts to import any of its Blob aliases into Supabase, provided their PDF IDs and URLs still match the new live `study_materials` table.
- Legacy files for PDFs not yet migrated remain accessible via the Blob fallback if that store is still connected.

For **all historical aliases, including links without a browser owner or PDFs not currently in Supabase**, use the one-time secure bulk importer:

```bash
# Run ONLY in a trusted local environment with the old store's token and a
# private key from the NEW 8aPDF Supabase project. Don't put them in Git.
export BLOB_READ_WRITE_TOKEN='...'
export SUPABASE_SECRET_KEY='...'

# Preview records; no writes:
node scripts/migrate-legacy-short-links.mjs

# After review, copy missing aliases without overwriting existing slugs:
node scripts/migrate-legacy-short-links.mjs --apply
```

It preserves legacy slug, PDF URL, owner hash, original created time, and document ID. Existing Supabase slugs are not overwritten; conflicting targets are reported and require manual review. The importer does **not** need the original PDF still to be present in Supabase, so it can preserve old redirects as-is.

Until the original Vercel Blob token/records are accessible, nobody can truthfully claim that all old aliases were restored. This migration is intentionally non-destructive, and neither old Blob objects nor the 8aPDF school data are deleted.

## Verification

After Vercel deploys the updated GitHub repository, test creation, availability, redirection and deletion using an actual published PDF card. The deployed Edge Function is `apdf_short_links` and the table is `public.short_links` at [the Supabase dashboard](https://supabase.com/dashboard/project/xudhjwojgxblbsebkzso/editor).

Run `npm test` to check source/JavaScript syntax and short-link regression coverage. A deployed REST request should be separately verified because Vercel can block private integrations, and the GitHub commit alone does not prove successful production deployment.
