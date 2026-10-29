"""Unit tests for the EduSecure holiday calendar worker (no live credentials)."""
import importlib.util
import json
from datetime import date
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    "edusecure_holiday_sync", ROOT / "scripts" / "edusecure_holiday_sync.py"
)
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)


class HolidaySyncTests(unittest.TestCase):
    def test_green_banner_text(self):
        result = worker.holiday_from_card("Karva Chauth\nDate : 29/10/2026\nView", date(2026, 10, 29))
        self.assertEqual(result, {
            "date": "2026-10-29",
            "reason": "Karva Chauth",
            "source": "edusecure-holiday-banner",
        })

    def test_date_validation(self):
        self.assertIsNone(worker.holiday_from_card("Karva Chauth Date : 31/02/2026 View", date(2026, 10, 29)))
        self.assertIsNone(worker.holiday_from_card("Test Date : 29/10/2026 View", date(2026, 10, 29)))
        self.assertIsNone(worker.holiday_from_card("Karva Chauth Date : 29/10/2019 View", date(2026, 10, 29)))

    def test_merge_preserves_manual_and_existing_calendar_rules(self):
        original = {
            "anchor": {"date": "2026-10-13", "day": 6},
            "cycleCorrections": [{"date": "2026-10-21", "day": 4}],
            "holidays": [
                {"date": "2026-10-29", "reason": "School confirmed closure", "source": "teacher-notice"},
                {"start": "2026-12-20", "end": "2026-12-25", "reason": "Winter break"},
            ],
        }
        result = worker.merge_calendar(original, [
            {"date": "2026-10-29", "reason": "Karva Chauth", "source": worker.SOURCE},
            {"date": "2026-11-01", "reason": "Festival break", "source": worker.SOURCE},
        ], "2026-10-29T00:00:00+05:30")
        self.assertEqual(result["holidays"][0]["reason"], "School confirmed closure")
        self.assertEqual(result["holidays"][1]["date"], "2026-11-01")
        self.assertEqual(result["holidays"][2]["start"], "2026-12-20")
        self.assertEqual(original["holidays"][0]["reason"], "School confirmed closure")
        self.assertEqual(result["cycleCorrections"], original["cycleCorrections"])
        self.assertEqual(result["holidaySync"]["status"], "synced")

    def test_idempotent_merging(self):
        data = {"holidays": []}
        card = {"date": "2026-10-29", "reason": "Karva Chauth", "source": worker.SOURCE}
        first = worker.merge_calendar(data, [card], "2026-10-29T00:00:00+05:30")
        second = worker.merge_calendar(first, [card], "2026-10-29T00:00:00+05:30")
        self.assertEqual(first, second)
        self.assertEqual(len(second["holidays"]), 1)

    def test_real_calendar_loads(self):
        config = json.loads((ROOT / "data" / "school-calendar.json").read_text(encoding="utf-8"))
        self.assertEqual(config["timeZone"], "Asia/Kolkata")
        self.assertIn("holidays", config)


if __name__ == "__main__":
    unittest.main()
