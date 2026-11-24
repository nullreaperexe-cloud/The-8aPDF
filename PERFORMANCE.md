# 8aPDF performance layer

The visual system remains in its existing CSS and animation files. Performance-specific behavior is isolated in small modules.

- `features/performance-flags.js` detects Save-Data, connection quality, memory and CPU tier before the first paint.
- `features/performance-styles.css` adds layout containment to long PDF and announcement lists without clipping shadows or changing keyframes.
- `features/idle-loader.js` keeps feature loading independently cacheable and reuses already-loaded modules when a user opens AI, tools, chat or notifications.
- `workspace-pages.js` marks embedded tools as lazy iframes so hidden tools do not compete with the homepage.
- `site-unified-font.css` no longer imports Space Grotesk a second time. The existing font link remains the single font request.
- `sw.js` and `vercel.json` cache versioned code and static assets for repeat visits while leaving HTML, API responses and unversioned files fresh.

The UI, animation keyframes, routes and existing feature entry points remain unchanged. Browser Lighthouse comparison still needs to run on the deployed domain because the current execution environment cannot start Chromium.
