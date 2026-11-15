# Alabaster Daylight UI for 8aPDF

## Architecture
8aPDF uses static HTML, CSS and vanilla JS rather than Tailwind/React. This release adds a shared CSS presentation layer and lightweight JavaScript enhancement, preserving existing IDs, delegated event handlers, name-only onboarding, routing, Firebase/Supabase connections, serverless APIs, chat and study features.

## Design & interactions
- Light-first #F8FAFC Alabaster palette, white frosted panels, slate typography, indigo actions, CSS-only background mesh.
- Fixed left navigation on desktop; existing sidebar controller manages mobile slide-out on the **left**, with old bottom dock visually hidden.
- Five featured announcement cards draw from live `__8apdfStudyBridge.announcements()` and use `openAnnouncement()` for the original reader and sharing.
- Reusable rAF mouse-position tilt and dynamic CSS specular glare on document/notices cards; reduced-motion/ultra-low safeguards.
- Subject explorer gets mobile left-side filter drawer while existing search, download, share, summarization, ZIP and bookmark actions remain untouched.
- Legacy pure-black default switches to light once without replacing user-custom theme settings.

## Checks before production
1. Desktop, tablet and 390px: only left sidebar for navigation, no clipped cards.
2. Name onboarding and returning-user welcome; Ctrl/Cmd+K, Escape and sidebar button.
3. All PDFs: subject filters, term filter, sorting, preview, download, sharing and ZIP.
4. Notices carousel opens the original announcement reader with attachments.
5. Chat rooms, messaging, uploads, custom tasks, notification settings and calendar.
6. Reduced-motion and ultra-low mode.
