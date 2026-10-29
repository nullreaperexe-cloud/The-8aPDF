"""Daily read-only EduSecure holiday-banner scanner for the 8aPDF calendar.

The scraper never writes to EduSecure. Only verified green date banners are
merged into data/school-calendar.json. Existing holidays are never removed.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

PORTAL_URL = "https://edusecure.org/ManavMangal88/ParentApp/Dashboard.aspx"
CALENDAR_PATH = Path(__file__).resolve().parents[1] / "data" / "school-calendar.json"
SOURCE = "edusecure-holiday-banner"
INDIA = ZoneInfo("Asia/Kolkata")
DATE_PATTERN = re.compile(r"\bDate\s*[:：]\s*(\d{1,2})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(20\d\d)\b", re.I)
NOT_HOLIDAY = re.compile(
    r"\b(?:exam|test|assessment|competition|result|meeting|assembly|workshop|"
    r"assignment|homework|class\s+work|admission|registration|sports\s+day)\b",
    re.I,
)

# Green upcoming-holiday cards are distinct from the white Circular/School Diary
# messages. Never mark a normal circular or a generic date as a school closure.
BANNER_SCAN_JS = r"""
const output = [], seen = new Set();
const dateRx = /\bDate\s*[:：]\s*\d{1,2}\s*[\/.-]\s*\d{1,2}\s*[\/.-]\s*20\d\d\b/i;
function greenCard(el) {
  for (let p=el, depth=0; p && depth<5; p=p.parentElement, depth++) {
    const st = getComputedStyle(p);
    const match = (st.backgroundColor || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
      const red = +match[1], green = +match[2], blue = +match[3];
      if (green>=65 && green>red*1.30 && green>blue*1.17) return true;
    }
  }
  return false;
}
for (const el of document.querySelectorAll('div, article, section, li, a')) {
  const st = getComputedStyle(el);
  if (st.display==='none' || st.visibility==='hidden') continue;
  const r = el.getBoundingClientRect();
  if (r.width<150 || r.height<65 || r.width>1150 || r.height>550) continue;
  const raw = (el.innerText || '').trim();
  if (!raw || raw.length>340 || !dateRx.test(raw) || !/\bView\b/i.test(raw)) continue;
  if (!greenCard(el)) continue;
  // The compactest element avoids accidentally extracting page chrome.
  const key = raw.replace(/\s+/g,' ').toLowerCase();
  if (seen.has(key)) continue;
  seen.add(key);
  output.push({text:raw, length:raw.length});
}
return output.sort((a,b)=>a.length-b.length).slice(0,40);
"""

SCROLL_SLIDER_JS = r"""
const widgets = Array.from(document.querySelectorAll('div,section,ul'))
  .filter(el=>el.scrollWidth>el.clientWidth+60 &&
          /\bDate\s*[:：]/i.test(el.innerText||'') &&
          /View/i.test(el.innerText||''))
  .sort((a,b)=>a.scrollWidth-b.scrollWidth);
if (!widgets.length) return false;
const el=widgets[0], before=el.scrollLeft;
el.scrollLeft=Math.min(el.scrollWidth-el.clientWidth,before+Math.max(280,el.clientWidth*.82));
return el.scrollLeft>before+5;
"""


def holiday_from_card(text: str, today: date | None = None) -> dict | None:
    """Parse a verified green upcoming-holiday card, not a generic notice."""
    value = " ".join(str(text or "").split())
    match = DATE_PATTERN.search(value)
    if not match:
        return None
    try:
        day, month, year = (int(n) for n in match.groups())
        when = date(year, month, day)
    except ValueError:
        return None
    today = today or datetime.now(INDIA).date()
    if not today - timedelta(days=45) <= when <= today + timedelta(days=730):
        return None
    title = value[:match.start()].strip(" :|-")
    title = re.sub(r"^(?:Holiday|Upcoming Holiday)\s*[:–-]?\s*", "", title, flags=re.I).strip()
    if not 2 <= len(title) <= 95 or NOT_HOLIDAY.search(title):
        return None
    return {"date": when.isoformat(), "reason": title, "source": SOURCE}


def merge_calendar(config: dict, cards: list[dict], checked_at: str) -> dict:
    """Idempotent merge: protect manual/noticed holidays and cycle corrections."""
    if not isinstance(config.get("holidays"), list):
        raise ValueError("Calendar holidays must be a list")
    by_date: dict[str, dict] = {}
    without_date: list[dict] = []
    for entry in config["holidays"]:
        if not isinstance(entry, dict):
            raise ValueError("Malformed existing holiday entry")
        if "date" in entry:
            by_date[entry["date"]] = entry.copy()
        else:
            without_date.append(entry.copy())
    for card in cards:
        when = card["date"]
        existing = by_date.get(when)
        if existing and existing.get("source") != SOURCE:
            continue
        by_date[when] = {**(existing or {}), **card}
    result = config.copy()
    result["holidays"] = sorted(by_date.values(), key=lambda h: h["date"]) + without_date
    result["holidaySync"] = {
        "source": SOURCE,
        "status": "synced",
        "checkedAt": checked_at,
        "bannersFound": len(cards),
    }
    return result


def login(driver, username: str, password: str) -> None:
    """Follow the proven input/button flow used by edusecure-pdf-sync."""
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait

    driver.get(PORTAL_URL)
    WebDriverWait(driver, 30).until(
        lambda d: d.execute_script("return document.readyState") in ("interactive", "complete")
    )

    def dashboard_ready() -> bool:
        return "login" not in driver.current_url.lower() and any(
            word in driver.find_element(By.TAG_NAME, "body").text
            for word in ("School Diary", "Circular", "Karva Chauth", "Dashboard")
        )

    if dashboard_ready():
        return

    WebDriverWait(driver, 30).until(
        lambda d: any(e.is_displayed() for e in d.find_elements(By.CSS_SELECTOR, 'input[type="password"]'))
    )
    visible = [e for e in driver.find_elements(By.CSS_SELECTOR, "input")
               if e.is_displayed() and (e.get_attribute("type") or "").lower()
               not in ("hidden", "submit", "button", "checkbox", "radio")]
    password_el = next((e for e in visible if (e.get_attribute("type") or "").lower() == "password"), None)
    username_el = next((e for e in visible if e != password_el), None)
    if not username_el or not password_el:
        raise RuntimeError("EduSecure login fields not found")
    username_el.clear()
    username_el.send_keys(username)
    password_el.clear()
    password_el.send_keys(password)
    clicked = driver.execute_script(r"""
    const buttons=Array.from(document.querySelectorAll('button,input[type="submit"],input[type="button"],a[role="button"]'))
      .filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0});
    const btn=buttons.find(el=>/login|log in|sign in|submit|continue/i.test(el.innerText||el.value||'')
                                 && !/logout|cancel/i.test(el.innerText||el.value||''))||buttons[0];
    if (!btn)return false;btn.click();return true;
    """)
    if not clicked:
        from selenium.webdriver.common.keys import Keys
        password_el.send_keys(Keys.ENTER)
    WebDriverWait(driver, 35).until(lambda d: dashboard_ready())
    # Reload the dashboard to place the scrolling holiday banner at its top.
    driver.get(PORTAL_URL)
    WebDriverWait(driver, 30).until(lambda d: dashboard_ready())


def scan_holiday_cards(driver) -> list[dict]:
    """Collect green holiday cards, including horizontally sliding ones."""
    driver.execute_script(r"""
      window.scrollTo(0,0);
      for(const el of document.querySelectorAll('div,section,main'))
        if(el.scrollHeight>el.clientHeight+100 && /Circular|School Diary|Date\s*:/i.test(el.innerText||''))
          el.scrollTop=0;
    """)
    seen: dict[str, dict] = {}
    for index in range(12):
        raw = driver.execute_script(BANNER_SCAN_JS) or []
        for candidate in raw:
            parsed = holiday_from_card(candidate.get("text", ""))
            if parsed:
                seen[parsed["date"]] = parsed
        moved = bool(driver.execute_script(SCROLL_SLIDER_JS))
        if not moved and index >= 2:
            break
        time.sleep(0.55)
    return sorted(seen.values(), key=lambda h: h["date"])


def run(dry_run: bool = False) -> int:
    username = os.getenv("EDUSECURE_USERNAME", "").strip()
    password = os.getenv("EDUSECURE_PASSWORD", "")
    if not username or not password:
        print("EduSecure credentials missing: add EDUSECURE_USERNAME and EDUSECURE_PASSWORD GitHub Actions secrets.")
        return 2
    from selenium import webdriver

    options = webdriver.ChromeOptions()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1440,1200")
    options.add_argument("--disable-notifications")
    options.add_argument("--disable-popup-blocking")
    driver = webdriver.Chrome(options=options)
    try:
        login(driver, username, password)
        time.sleep(1.5)
        holidays = scan_holiday_cards(driver)
    finally:
        driver.quit()

    if not holidays:
        print("No verified green holiday banners found. Calendar left unchanged; check portal layout.")
        return 1
    before = json.loads(CALENDAR_PATH.read_text(encoding="utf-8"))
    now = datetime.now(INDIA).isoformat(timespec="seconds")
    after = merge_calendar(before, holidays, now)
    for h in holidays:
        print(f"Verified holiday: {h['date']} - {h['reason']}")
    if dry_run:
        print("Dry-run: no calendar file changed.")
        return 0
    CALENDAR_PATH.write_text(json.dumps(after, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Saved {len(holidays)} verified banner(s) to calendar. Existing holidays preserved.")
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    try:
        sys.exit(run(dry_run=args.dry_run))
    except Exception as error:
        # Never print credentials, cookies, DOM source or sensitive URL params.
        print(f"Holiday worker failed safely: {type(error).__name__}")
        sys.exit(1)
