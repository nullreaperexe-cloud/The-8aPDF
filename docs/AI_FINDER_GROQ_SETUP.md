# AI PDF Finder — Groq setup

The PDF Finder is local-first for instant responses. Its relevance engine scores subject, exact chapter, topic, description, PDF tags, class metadata and teacher announcements, with strict rejections for wrong chapters and unrelated subjects.

Groq powers two independent optional parts:

1. **Daily offline keyword enrichment** (GitHub Actions). The job reads published metadata from https://8apdf.me/api/materials and https://8apdf.me/api/announcements, asks the Groq 70B model for grounded search synonyms, and commits a small JSON index in data/ai-finder-training.json. The browser loads this file in the background and NEVER waits for Groq during instant matching.
2. **Complex questions and PDF summaries** (Vercel). The Groq 8B model only receives selected source metadata or extracted PDF text on an explicit AI request. The browser never sees the API key.

## Required configuration

**GitHub repository:** nullreaperexe-cloud/The-8aPDF → Settings → Secrets and variables → Actions → New repository secret.

- Secret name: GROQ_API_KEY.
- After adding it, run Actions → Train AI Finder Search Keywords (Groq) → Run workflow.
- Scheduled daily at 01:00 AM India time (19:30 UTC).

**Vercel project serving 8apdf.me:**

- Add the same GROQ_API_KEY environment variable for Production (and Preview if necessary), then redeploy.
- GitHub Actions secrets do NOT automatically populate Vercel environment variables. Both are necessary for offline training AND optional runtime AI.
- GEMINI_API_KEY is no longer needed by Finder or summary server code. Remove that legacy Vercel variable only after confirming the Groq redeployment.

## Performance, correctness and privacy

- All normal PDF/announcement matches remain instant local ranking, without Groq queries.
- Derived training keywords and short fingerprints are published; raw PDF contents, keys, and credentials are NOT committed to the index.
- If a training run fails, the existing index remains unchanged.
- AI-suggested IDs are checked against actual supplied PDF/announcement IDs.
- Publication dates are never substituted for future exam dates.
- This is search metadata enrichment, not fine-tuning model weights. Search inside scanned PDF images needs separate OCR/content indexing.

## Testing

Run npm run test:ai-finder. This tests exact in-page chapter/subject ranking, teacher-message retrieval, server Groq API contract, and trainer syntax.
