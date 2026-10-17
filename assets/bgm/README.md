# 8aPDF · Background music (original MP3 files)

## One-ZIP automatic installation

1. Upload **8apdf-four-original-bg-tracks.zip** to the **repository ROOT** (beside `index.html`), **not inside this folder**.
2. Commit to `main`.
3. GitHub Actions workflow `.github/workflows/install-bgm-tracks.yml` verifies the SHA-256 of all four original MP3s, extracts them to this folder **without changing one audio byte**, deletes the old `assets/8apdf-background-music.mp3`, deletes the ZIP and commits the result.
4. Vercel automatically deploys the changes when GitHub integration is enabled.

If the action cannot push (for example, due to branch protection), extract the ZIP on your computer and upload its four files directly to `assets/bgm/`, and delete the previous MP3 manually after verifying playback.

## Exact filenames

- `tum-hi-ho.mp3` — Tum Hi Ho (piano cover, first visit)
- `meri-duniya-tu-hi-re.mp3` — Meri Duniya Tu Hi Re (lyrical)
- `khairiyat.mp3` — Khairiyat (piano cover)
- `saiyaara.mp3` — Saiyaara (peaceful instrumental)

First visit: Tum Hi Ho. Each later refresh: a random song different from the last. Site Settings → Music provides selection, shuffle, pause, on/off and volume.

Modern browsers may block sound before the first user gesture. The website attempts autoplay and starts on the first tap/click when required.

**Licensing:** Only publicly distribute audio recordings when you have the necessary rights.
