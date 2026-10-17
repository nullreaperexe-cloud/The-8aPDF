# 8aPDF — Original-quality three-song background music

The website serves three original MP3 assets (without re-encoding):

1. `tum-hi-ho.mp3` — Tum Hi Ho (piano cover)
2. `khairiyat.mp3` — Khairiyat (piano cover)
3. `saiyaara.mp3` — Saiyaara (peaceful instrumental)

## Settings → Music

Select one, two or all three songs. The selection is saved in localStorage (`8apdf_background_music_v1`) and restored on refresh.

- **One selected:** that song loops indefinitely.
- **Two selected:** the selected songs play in the canonical order, then repeat.
- **All three selected:** Tum Hi Ho → Khairiyat → Saiyaara → repeat.
- **Only this:** choose a song for permanent single-track looping.
- **Play all 3 in order:** resets to the full ordered playlist.
- Music enable, pause and volume controls remain available.

Song source bytes are not modified. Browser autoplay policies can still require a user gesture before playback.

The older four-song ZIP importer has been retired because it referenced a track intentionally removed from the site. Only publish recordings when you have appropriate distribution rights.
