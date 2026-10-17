# 8aPDF · Four background tracks

Upload the four **original, unmodified** MP3 files into this exact directory, using these exact filenames:

- `tum-hi-ho.mp3` — Tum Hi Ho (piano cover; first-visit track)
- `meri-duniya-tu-hi-re.mp3` — Meri Duniya Tu Hi Re (lyrical)
- `khairiyat.mp3` — Khairiyat (piano cover)
- `saiyaara.mp3` — Saiyaara (peaceful instrumental)

The site's player is already configured to use paths starting with `/assets/bgm/`. It selects Tum Hi Ho the first time a browser visits, then chooses a different random track on every new page load. Visitors may choose another song under **Settings → Music**. Tracks loop in their existing original MP3 encoding; the frontend never transcodes them.

The old `/assets/8apdf-background-music.mp3` remains a temporary fallback **only if one of the new files is missing**. After all four MP3s are uploaded and confirmed playable, the old file can be deleted safely. Browsers can restrict unprompted autoplay; the first click or tap retries playback.

Only publish recordings you have the necessary rights to distribute.