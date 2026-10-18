"""8aPDF OpenTune-derived discovery: public YouTube Music song search.

Source approach: https://github.com/harshitethic/OpenTune (MIT licensed).
Uses ytmusicapi only for music metadata. Playback uses Google's official,
visible YouTube IFrame embed in the frontend, never audio extraction.
Keeps legacy /api/music-search JSON 'items' fields for existing consumers.
"""
import json
import re
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

from ytmusicapi import YTMusic

VIDEO_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")
AVOID = re.compile(
    r"\b(?:slowed|reverb|nightcore|karaoke|sped\s*up|lofi|8d\s*audio|"
    r"mashup|fanmade|unofficial\s*cover|reaction|lyrics\s*video)\b",
    re.IGNORECASE,
)
DISCOVER = {
    "hindi": "Bollywood Hindi popular songs 2026",
    "punjabi": "Punjabi popular hits 2026",
    "english": "English pop hits 2026",
}
MAX_QUERY = 110


def clean_text(value, length=155):
    return str(value or "").strip()[:length]


def json_result(resource, code=200, cache=False):
    payload = json.dumps(resource, ensure_ascii=False).encode("utf-8")
    return payload, code, "public, s-maxage=180, stale-while-revalidate=180" if cache else "no-store"


def duration_in_seconds(raw):
    if isinstance(raw, (int, float)):
        return max(0, min(int(raw), 20000))
    try:
        pieces = [int(i) for i in str(raw or "").split(":")]
        if len(pieces) not in (2, 3):
            return 0
        result = 0
        for i in pieces:
            result = 60 * result + i
        return max(0, min(result, 20000))
    except (ValueError, TypeError):
        return 0


def search_music(query, locale, limit, skip_unofficial=True):
    yt = YTMusic(language="en", location="IN")
    rows = yt.search(query, filter="songs", limit=max(20, limit + 12))
    result = []
    already = set()
    for entry in rows:
        video_id = entry.get("videoId")
        if not isinstance(video_id, str) or not VIDEO_ID.fullmatch(video_id):
            continue
        if video_id in already:
            continue
        title = clean_text(entry.get("title"))
        if not title:
            continue
        artists = entry.get("artists") or []
        artist = clean_text(", ".join(str(a.get("name") or "") for a in artists if isinstance(a, dict)), 120)
        if skip_unofficial and AVOID.search(title):
            continue
        thumbs = entry.get("thumbnails") or []
        image = next(
            (x["url"] for x in reversed(thumbs) if isinstance(x, dict)
             and isinstance(x.get("url"), str) and x["url"].startswith("https://")), ""
        )
        already.add(video_id)
        result.append({
            "id": video_id,
            "videoId": video_id,
            "title": title,
            "artist": artist or "Unknown artist",
            "artwork": image,
            "duration": duration_in_seconds(entry.get("duration_seconds") or entry.get("duration")),
            "album": clean_text((entry.get("album") or {}).get("name") if isinstance(entry.get("album"), dict) else "", 100),
            "source": "YouTube Music",
        })
        if len(result) >= limit:
            break
    return result


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = urlparse(self.path)
        params = parse_qs(path.query)
        query = clean_text(params.get("q", [""])[0], MAX_QUERY)
        locale = clean_text(params.get("lang", ["hindi"])[0].lower(), 20)
        if locale not in DISCOVER:
            locale = "hindi"
        provider = params.get("provider", [""])[0].lower()
        try:
            limit = max(1, min(30, int(params.get("limit", ["20"])[0])))
        except (TypeError, ValueError):
            limit = 20
        if len(query) == 1:
            payload, status, cache = json_result({"error": "Enter at least two characters."}, 400)
        else:
            term = query or DISCOVER[locale]
            try:
                tracks = search_music(term, locale, limit)
                # Preserve other existing callers: YouTube IDs + video metadata.
                if provider == "opentune":
                    response = {"tracks": tracks, "hasMore": False, "source": "OpenTune / YouTube Music"}
                else:
                    response = {"items": [
                        {"videoId": t["videoId"], "title": t["title"], "channel": t["artist"]}
                        for t in tracks
                    ]}
                payload, status, cache = json_result(response, cache=True)
            except Exception as exc:
                print("OpenTune discovery error:", type(exc).__name__, str(exc)[:160])
                payload, status, cache = json_result({
                    "error": "YouTube Music discovery is temporarily unavailable. Please retry.",
                    "code": "OPENTUNE_SEARCH_UNAVAILABLE"
                }, 502)
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", cache)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)
