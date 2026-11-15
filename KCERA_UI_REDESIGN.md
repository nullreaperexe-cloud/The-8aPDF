# 8aPDF — KCERA-inspired UI refresh

This change deliberately preserves the vanilla HTML/CSS/JavaScript architecture. The existing project does **not** use React or Tailwind, so adding a Tailwind build pipeline for presentation-only changes would introduce avoidable deployment risk.

## What's changed
- A shared dark-first visual stylesheet at `/kcera-redesign.css` is loaded after existing page styles.
- Glass surfaces, soft CSS-only ambient gradients, simplified text-based app icons, accessible focus rings, and reduced-motion handling.
- Reworked visual treatment for the home hero, floating navigation, study widgets, PDF cards, subject explorer, mobile nav, name onboarding, standalone PDFs/tasks/updates/settings, and friends chat.
- No new images, canvas, or WebGL dependency.

## What is intentionally unchanged
- App structure, IDs, data attributes, routes, auth/name-onboarding flow, PDF actions, API endpoints, events, storage, Supabase/Firebase integrations, chat behavior and service worker logic.
- Classic mode and appearance controls remain available.

## Quick verification checklist
1. First visit: complete name onboarding, reload, ensure name persists.
2. Home: sidebar, floating search, mobile bottom nav, settings and shortcuts.
3. Explorer: subject filter, search, sort, preview, download, share, summarize and ZIP export.
4. Tasks and updates: filtering, adding/completing tasks, reading announcements.
5. Chat: open room, send message, reply, open attachments.
6. At 375px, 768px and desktop widths: no clipped interactive elements.
7. Reduced motion/ultra-low settings: no mandatory decorative animation.
8. Check browser console, then merge after preview review.

Note: this is a CSS-layer refactor, not a separate login/signup implementation; 8aPDF currently uses name-only onboarding.
