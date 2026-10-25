"""Batch lecture preparation must be non-destructive, collision-safe and repeatable."""

from contextlib import redirect_stdout
from io import StringIO
import json
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import new_lecture as intake
import batch_lecture_drafts as batch


class BatchLectureIntakeTests(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / "lectures").mkdir()
        self.catalog = self.root / "lectures" / "catalog.json"
        self.catalog.write_text(json.dumps({"version": 1, "schemaVersion": 2, "lectures": []}), encoding="utf-8")
        for name, value in (("ROOT", self.root), ("LECTURES", self.root / "lectures")):
            patcher = patch.object(intake, name, value)
            patcher.start()
            self.addCleanup(patcher.stop)

        def course_pack(course):
            options = {
                "surgery": {"subjects": [{"id": "urology", "label": "Urology"}]},
                "internal-medicine": {"subjects": [{"id": "cardiology", "label": "Cardiology"}]},
            }
            if course not in options:
                intake.fail(f"unknown course: {course}")
            return self.root / "courses" / f"{course}.json", options[course]

        patcher = patch.object(intake, "course_pack", side_effect=course_pack)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.manifest = self.root / "manifest.json"
        self.queue = self.root / "tmp" / "lecture-drafts"

    def row(self, title, *, course="surgery", subject="urology", **extra):
        return {
            "course": course, "subject": subject, "title": title,
            "source": f"{title}.pdf", **extra,
        }

    def execute(self, rows, *, write=False):
        self.manifest.write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")
        with patch.object(sys, "argv", [
            "batch_lecture_drafts.py", str(self.manifest), *(["--write"] if write else [])
        ]), redirect_stdout(StringIO()) as output:
            batch.main()
        return output.getvalue()

    def test_dry_run_is_read_only_and_batch_creates_sequential_lecture_drafts(self):
        rows = [self.row("Renal Tumors II"), self.row("Urethral Stricture")]
        before = self.catalog.read_bytes()
        preview = self.execute(rows)
        self.assertIn('"mode": "dry-run"', preview)
        self.assertEqual(self.queue.exists(), False)
        self.assertEqual(before, self.catalog.read_bytes())

        self.execute(rows, write=True)
        first = json.loads((self.queue / "surgery-urology-renal-tumors-ii.json").read_text())
        second = json.loads((self.queue / "surgery-urology-urethral-stricture.json").read_text())
        self.assertEqual((first["order"], second["order"]), (1, 2))
        self.assertEqual((first["courseId"], second["courseId"]), ("surgery", "surgery"))
        self.assertEqual(first["cases"], [])
        self.assertNotIn("studyGuide", second)
        self.assertEqual(before, self.catalog.read_bytes())
        with self.assertRaisesRegex(SystemExit, "draft already exists"):
            self.execute(rows, write=True)

    def test_existing_draft_reserves_order_for_bulk_and_single_intake(self):
        self.queue.mkdir(parents=True)
        (self.queue / "surgery-urology-old.json").write_text(json.dumps({
            "id": "surgery-urology-old", "subjectKey": "urology", "order": 3,
        }), encoding="utf-8")
        self.execute([self.row("New Lecture")], write=True)
        draft = json.loads((self.queue / "surgery-urology-new-lecture.json").read_text())
        self.assertEqual(draft["order"], 4)

        with patch.object(sys, "argv", [
            "new_lecture.py", "--course", "surgery", "--subject", "urology",
            "--title", "Next Lecture", "--source", "Next.pdf",
        ]), redirect_stdout(StringIO()):
            intake.main()
        created = json.loads((self.queue / "surgery-urology-next-lecture.json").read_text())
        self.assertEqual(created["order"], 5)

    def test_duplicate_ids_and_orders_fail_before_any_write(self):
        rows = [self.row("A"), self.row("B", order=1)]
        with self.assertRaisesRegex(SystemExit, "order 1"):
            self.execute(rows, write=True)
        self.assertFalse(self.queue.exists())

        rows = [self.row("A", id="shared-id"), self.row(
            "B", course="internal-medicine", subject="cardiology", id="shared-id")]
        with self.assertRaisesRegex(SystemExit, "draft already exists with id"):
            self.execute(rows, write=True)
        self.assertFalse(self.queue.exists())

    def test_bad_entries_and_published_identity_collisions_fail_closed(self):
        self.catalog.write_text(json.dumps({"lectures": [
            {"id": "surgery-urology-already-published", "courseId": "surgery",
             "subjectKey": "urology", "order": 1},
        ]}), encoding="utf-8")
        with self.assertRaisesRegex(SystemExit, "already exists"):
            self.execute([self.row("Already Published")], write=True)
        with self.assertRaisesRegex(SystemExit, "unsupported fields"):
            self.execute([dict(self.row("Other"), private_data="no")], write=True)
        with self.assertRaisesRegex(SystemExit, "must be a non-empty JSON array"):
            self.execute([], write=True)
        self.assertFalse(self.queue.exists())

    def test_write_error_rolls_back_entire_new_batch(self):
        original_open = Path.open
        new_creations = 0

        def flaky_open(path, *args, **kwargs):
            nonlocal new_creations
            mode = args[0] if args else kwargs.get("mode", "r")
            if mode == "x":
                new_creations += 1
                if new_creations == 2:
                    raise OSError("simulated full disk")
            return original_open(path, *args, **kwargs)

        with patch.object(Path, "open", flaky_open):
            with self.assertRaisesRegex(SystemExit, "rolled back"):
                self.execute([self.row("One"), self.row("Two")], write=True)
        self.assertEqual(list(self.queue.glob("*.json")), [])
        self.assertEqual(json.loads(self.catalog.read_text())["lectures"], [])


if __name__ == "__main__":
    unittest.main()
