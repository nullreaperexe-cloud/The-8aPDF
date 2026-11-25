# AI PDF Finder — local-first and Groq Thinking

Default Finder uses the existing browser catalog, announcements and offline ranking index. Opening, searching and local misses do not call Groq. Enable the red Thinking toggle explicitly for grounded AI search. AI Chat and Study Solver are separate Groq-powered modes.

Add GROQ_API_KEY in Vercel project the-8apdf → Settings → Environment Variables → Production (Preview optional). Redeploy after saving. GitHub Actions secrets are not available to Vercel runtime and cannot be read back. Never commit or expose the key. The scheduled Groq trainer is retired.

Finder Thinking and text chat use openai/gpt-oss-120b; screenshots use qwen/qwen3.8-27b. Optional overrides: GROQ_CHAT_MODEL and GROQ_VISION_MODEL. Run npm run test:ai-finder for regression checks.
