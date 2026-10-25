# Google login setup for 8aPDF (required one-time configuration)

The site already uses Supabase Auth in project `xudhjwojgxblbsebkzso` with a **publishable** browser key. Its account/profile UI cannot log users in with Google until the **Google provider** is enabled in Supabase Authentication.

## Step 1 — Create Google OAuth credentials

1. Visit https://console.cloud.google.com/auth/overview and select the Google Cloud project you intend to use for 8aPDF.
2. Configure the OAuth consent screen Branding/Audience. For public access choose **External** and publish the app when ready. If it is in testing mode, list each allowed test email.
3. Under Clients, create an **OAuth Client ID → Web application**.
4. Add these Authorized JavaScript origins as relevant:
   - `https://8apdf.me`
   - `https://www.8apdf.me`
   - `https://the-8apdf.vercel.app`
   - `https://8apdf.vercel.app`
5. Under **Authorized redirect URIs**, add this exact Supabase callback URL:
   - `https://xudhjwojgxblbsebkzso.supabase.co/auth/v1/callback`
6. Save the Google **Client ID** and **Client secret**. Never commit the secret to GitHub and never put it into browser JavaScript.

## Step 2 — Enable Supabase provider

1. Open https://supabase.com/dashboard/project/xudhjwojgxblbsebkzso/auth/providers .
2. Open **Google**, enable Sign in with Google, paste the Client ID and secret, and **Save**.
3. Open Authentication → URL Configuration: https://supabase.com/dashboard/project/xudhjwojgxblbsebkzso/auth/url-configuration .
4. Set the Site URL to `https://8apdf.me`. Include Redirect URL allowlist entries for the production hostname and any actively used aliases, including:
   - `https://8apdf.me/**`
   - `https://www.8apdf.me/**`
   - `https://the-8apdf.vercel.app/**`
   - `https://8apdf.vercel.app/**`
5. Save. Sign in on a private browsing tab and repeat the test from another phone/PC with the same Google identity.

## Expected user behavior

- New visitor: name screen → optional Google Sign up, Login, or Continue without signing up.
- Existing visitor: existing name is retained; optional Google choice shown once.
- Signed-in visitor: name and selected browser study data stored in `public.user_workspace_items` with per-user row-level policies. Previously owned short links are combined under an account key ring.
- Guest: normal local browser storage, no Google required.
- Google login and signup are the same OAuth provider operation, so Google decides whether this identity is signing up or signing in.

## Diagnosis

Supabase Auth logs on 2026-10-25 confirmed `HTTP 400 /authorize: provider is not enabled`. This is a dashboard/provider configuration problem, not a JavaScript credential error. Until Google is enabled, the browser preflight shows a friendly configuration notice instead of navigating to the raw HTTP 400 error.

## Official reference

https://supabase.com/docs/guides/auth/social-sign-in/auth-google
