"""Regression tests for multi-lecture draft queue (no published files touched)."""
import importlib.util
import json
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

TOOLS = Path(__file__).resolve().parents[1] / "tools"
sys.path.insert(0, str(TOOLS))
import add_lecture
import new_lecture
import batch_new_lectures


class BatchDraftTests(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for module in (add_lecture, new_lecture, batch_new_lectures):
            previous = module.ROOT
            module.ROOT = self.root
            self.addCleanup(setattr, module, "ROOT", previous)
        for key, value in [
            ("LECTURES", self.root / "lectures"),
            ("COURSES", self.root / "courses"),
            ("CATALOG_PATH", self.root / "lectures" / "catalog.json"),
        ]:
            old = getattr(add_lecture, key)
            setattr(add_lecture, key, value)
            self.addCleanup(setattr, add_lecture, key, old)
        old = new_lecture.LECTURES
        new_lecture.LECTURES = self.root / "lectures"
        self.addCleanup(setattr, new_lecture, "LECTURES", old)
        self.save("courses/catalog.json", {"courses": [
            {"id": "surgery", "pack": "packs/surgery.json"}]})
        self.save("courses/packs/surgery.json", {"id": "surgery", "subjects": [
            {"id": "urology", "label": "Urology"}]})
        self.save("lectures/catalog.json", {"lectures": [
            {"id": "existing", "courseId": "surgery", "subjectKey": "urology", "order": 1}]})

    def save(self, name, data):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data), encoding="utf-8")

    def sample(self, title):
        return {"course": "surgery", "subject": "urology", "title": title, "source": title + ".pdf"}

    def test_batch_assigns_unique_orders_without_mutating_catalog(self):
        before = (self.root / "lectures/catalog.json").read_bytes()
        planned = batch_new_lectures.plan_batch([self.sample("BPH"), self.sample("Bladder Cancer")])
        self.assertEqual([x["order"] for x in planned], [2, 3])
        self.assertEqual([x["id"] for x in planned], [
            "surgery-urology-bph", "surgery-urology-bladder-cancer"])
        self.assertEqual((self.root / "lectures/catalog.json").read_bytes(), before)
        self.assertFalse((self.root / "tmp").exists())

    def test_pending_drafts_reserve_number_and_id(self):
        pending = self.root / "tmp/lecture-drafts"
        pending.mkdir(parents=True)
        (pending / "pending.json").write_text(json.dumps({
            "id": "surgery-urology-pending", "courseId": "surgery",
            "subjectKey": "urology", "order": 2}), encoding="utf-8")
        planned = batch_new_lectures.plan_batch([self.sample("Next")])
        self.assertEqual(planned[0]["order"], 3)
        with self.assertRaisesRegex(SystemExit, "draft already exists"):
            batch_new_lectures.plan_batch([self.sample("Pending")])

    def test_duplicate_manifest_rejected_before_files_are_created(self):
        with self.assertRaisesRegex(SystemExit, "draft already exists"):
            batch_new_lectures.plan_batch([self.sample("A"), self.sample("A")])
        with self.assertRaisesRegex(SystemExit, "order"):
            batch_new_lectures.plan_batch([
                dict(self.sample("A"), order=2), dict(self.sample("B"), order=2)])
        self.assertFalse((self.root / "tmp").exists())

    def test_rejects_unregistered_or_malformed_rows(self):
        with self.assertRaisesRegex(SystemExit, "required"):
            batch_new_lectures.plan_batch([{"course": "surgery"}])
        with self.assertRaisesRegex(SystemExit, "not registered"):
            batch_new_lectures.plan_batch([dict(self.sample("A"), subject="missing")])
        with self.assertRaisesRegex(SystemExit, "unsupported fields"):
            batch_new_lectures.plan_batch([dict(self.sample("A"), approved=True)])


    def test_cli_preview_and_write_do_not_touch_published_files(self):
        from contextlib import redirect_stdout
        from io import StringIO
        manifest = self.root / "batch.json"
        manifest.write_text(json.dumps([self.sample("One"), self.sample("Two")]), encoding="utf-8")
        original_catalog = (self.root / "lectures/catalog.json").read_bytes()
        cli = ["batch_new_lectures.py", str(manifest)]
        with patch.object(sys, "argv", cli), redirect_stdout(StringIO()) as output:
            batch_new_lectures.main()
        self.assertIn("Dry-run passed", output.getvalue())
        self.assertFalse((self.root / "tmp").exists())

        with patch.object(sys, "argv", cli + ["--write"]), redirect_stdout(StringIO()):
            batch_new_lectures.main()
        self.assertEqual(
            [json.loads(path.read_text())["order"]
             for path in sorted((self.root / "tmp/lecture-drafts").glob("*.json"))],
            [2, 3],
        )
        self.assertEqual((self.root / "lectures/catalog.json").read_bytes(), original_catalog)

    def test_cli_write_failure_removes_newly_created_drafts(self):
        manifest = self.root / "batch.json"
        manifest.write_text(json.dumps([self.sample("First"), self.sample("Second")]), encoding="utf-8")
        original_catalog = (self.root / "lectures/catalog.json").read_bytes()
        real_open = Path.open
        attempts = 0

        def fail_second_creation(path, *args, **kwargs):
            nonlocal attempts
            mode = args[0] if args else kwargs.get("mode", "r")
            if mode == "x":
                attempts += 1
                if attempts == 2:
                    raise OSError("simulated write failure")
            return real_open(path, *args, **kwargs)

        with patch.object(sys, "argv", ["batch_new_lectures.py", str(manifest), "--write"]), \
                patch.object(Path, "open", fail_second_creation), \
                self.assertRaisesRegex(SystemExit, "rolled back"):
            batch_new_lectures.main()
        self.assertEqual(list((self.root / "tmp/lecture-drafts").glob("*.json")), [])
        self.assertEqual((self.root / "lectures/catalog.json").read_bytes(), original_catalog)


if __name__ == "__main__":
    unittest.main()
