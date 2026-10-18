# 8aPDF Music — Google Drive / VS Code

This site has a browser UI plus a Google Drive serverless API. **VS Code Live Server** serves static files only and cannot run the backend; music may be missing on Live Server.

## Local VS Code steps (no extra payments)

1. Open the newest GitHub `main` branch. If already cloned, run `git pull origin main` in VS Code Terminal.
2. Install [Node.js 22 LTS](https://nodejs.org/) or newer and run `npm install` if needed.
3. Link your **existing** Vercel project and pull its Production environment settings securely into a locally ignored file:

```powershell
npx vercel login
npx vercel link
npx vercel env pull .env.local --environment=production
```

When prompted, select your existing project **the-8apdf** and existing team. Do not create a new Vercel project.

4. Start a local music-API-enabled server:

```powershell
npm run dev:music
```

5. Open **http://localhost:4173** (not the Go Live / Live Server port 5500). Use **Music Library** in the left sidebar or **More → Music Library** on mobile.
6. Test the Drive backend at these URLs:

- http://localhost:4173/__music/health — both environment flags should be true
- http://localhost:4173/api/music-search?action=status — `ok: true`, `folderConnected: true`, and the expected `folderName` and track `count`
- http://localhost:4173/api/music-search?action=tracks — JSON list of your real Google Drive MP3s

## Troubleshooting

- **"Live Server does not run Vercel APIs"**: do not use Go Live. Use **http://localhost:4173**.
- **"Google Drive configuration is missing"**: pull **Production** Vercel variables again with `npx vercel env pull .env.local --environment=production`.
- **"Google Drive service account JSON invalid"**: check the complete JSON credential in the existing Vercel project's Production Environment Variables.
- **"Google Drive folder access denied"**: share your Drive music folder with the service-account email as Viewer, and enable the Drive API.
- **"0 songs"**: upload MP3 files directly inside the correct Drive folder (not nested subfolders), and use ↻ Refresh.
- **Live website still old**: Vercel GitHub builds were blocked by a Hobby build-rate limit. Inspect the Deployment page to see the actual deployed commit.
- **Audio cannot stream**: Drive may enforce quota/rate limits; it isn't a dedicated public streaming CDN.

## Security

- Do **not** commit or share `.env.local`, service account JSON, OAuth tokens, or private keys. `.gitignore` already excludes `.env.*`.
- Files remain stored in Google Drive at their original quality; the server delivers ranged chunks.
- This lightweight development server emulates only the music API. For every 8aPDF API, use the Vercel CLI local runtime with suitable environment variables.
- The current music streaming API has no per-user access control. Do not publish commercially downloaded recordings to students without appropriate distribution rights and access controls.
