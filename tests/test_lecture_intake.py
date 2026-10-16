"""Safe lecture authoring integration tests (stdlib only; no real bank mutations)."""

from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory
import importlib.util
import json
import os
import sys
import unittest
from unittest.mock import patch

ROOT_SOURCE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_SOURCE / "tools"))
spec = importlib.util.spec_from_file_location("lecture_intake_test_module", ROOT_SOURCE / "tools" / "add_lecture.py")
intake = importlib.util.module_from_spec(spec)
spec.loader.exec_module(intake)


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def draft(course="internal-medicine"):
    subject = "Cardiology" if course == "internal-medicine" else "Urology"
    return {
        "id": f"{course}-test-lecture",
        "order": 2,
        "subjectKey": "cardiology" if course == "internal-medicine" else "urology",
        "subject": subject,
        "title": "Reviewed source lecture",
        "subtitle": "Lecture-first example",
        "sourceNote": "Source: teaching lecture PDF p.1 (test fixture only)",
        "subtopics": [{"id": "overview", "label": "Overview"}],
        "cases": [],
        "coreShorts": [{
            "id": "test-q1",
            "q": "What is the term used in the source?",
            "a": "The reviewed term.",
            "topic": "Overview",
            "priority": "Core",
            "marks": 1,
            "subtopics": ["overview"],
        }],
        "imageQuestions": [],
        "detailedShorts": [],
        "rapid": [],
    }


class LectureIntakeTests(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        self.root = root
        save(root / "courses" / "catalog.json", {
            "courses": [
                {"id": "internal-medicine", "label": "Internal Medicine", "pack": "packs/internal-medicine.json"},
                {"id": "surgery", "label": "Surgery", "pack": "packs/surgery.json"},
            ]
        })
        save(root / "courses" / "packs" / "internal-medicine.json", {
            "id": "internal-medicine", "subjects": [{"id": "cardiology", "label": "Cardiology"}],
        })
        save(root / "courses" / "packs" / "surgery.json", {
            "id": "surgery", "subjects": [{"id": "urology", "label": "Urology"}],
            "lectureCatalog": "../../lectures/catalog.json"
        })
        save(root / "courses" / "packs" / "surgery-baseline.json", {
            "protectedLectures": [{"id": "historical-surgery", "title": "Historical",
                                   "subjectKey": "urology", "order": 1,
                                   "expectedCounts": {"cases": 1, "coreShorts": 0,
                                                      "imageQuestions": 0, "detailedShorts": 0, "rapid": 0}}],
        })
        save(root / "lectures" / "catalog.json", {"version": 1, "schemaVersion": 2, "lectures": []})
        (root / "lectures" / "data").mkdir(exist_ok=True)
        self.catalog = root / "lectures" / "catalog.json"
        self.previous_root, self.previous_lectures = intake.ROOT, intake.LECTURES
        self.previous_courses, self.previous_catalog = intake.COURSES, intake.CATALOG_PATH
        intake.ROOT, intake.LECTURES = root, root / "lectures"
        intake.COURSES, intake.CATALOG_PATH = root / "courses", self.catalog
        self.addCleanup(self.restore_globals)

    def restore_globals(self):
        intake.ROOT, intake.LECTURES = self.previous_root, self.previous_lectures
        intake.COURSES, intake.CATALOG_PATH = self.previous_courses, self.previous_catalog

    def run_cli(self, course="internal-medicine", flags=()):
        with patch.object(sys, "argv", ["add_lecture.py", str(self.root / "draft.json"),
                                        "--course", course, *flags]):
            with redirect_stdout(StringIO()):
                intake.main()

    def test_new_draft_scaffolds_empty_reviewable_course_lecture(self):
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "draft_generator_test_module", ROOT_SOURCE / "tools" / "new_lecture.py"
        )
        generator = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(generator)
        generator.ROOT, generator.LECTURES = self.root, self.root / "lectures"
        generator.course_pack = intake.course_pack
        generator.read_json = intake.read_json
        with patch.object(sys, "argv", [
            "new_lecture.py", "--course", "internal-medicine", "--subject", "cardiology",
            "--title", "Cardiac Pharmacology", "--source", "Lecture.pdf",
        ]):
            with redirect_stdout(StringIO()):
                generator.main()
        path = self.root / "tmp" / "lecture-drafts" / "cardiology-cardiac-pharmacology.json"
        self.assertTrue(path.is_file())
        content = json.loads(path.read_text())
        self.assertEqual(content["order"], 1)
        self.assertEqual(content["sourceNote"].split(";")[0], "PDF source: Lecture.pdf")
        self.assertEqual(content["subject"], "Cardiology")
        self.assertEqual(content["coreShorts"], [])
        with patch.object(sys, "argv", [
            "new_lecture.py", "--course", "internal-medicine", "--subject", "cardiology",
            "--title", "Cardiac Pharmacology", "--source", "Lecture.pdf",
        ]):
            with self.assertRaisesRegex(SystemExit, "draft already exists"):
                generator.main()

    def test_dry_run_does_not_change_sources(self):
        save(self.root / "draft.json", draft())
        before = self.catalog.read_bytes()
        self.run_cli()
        self.assertEqual(self.catalog.read_bytes(), before)
        self.assertFalse((self.root / "lectures" / "data" / "internal-medicine-test-lecture.json").exists())

    def test_write_requires_explicit_medical_review(self):
        save(self.root / "draft.json", draft())
        with self.assertRaisesRegex(SystemExit, "requires --reviewed"):
            self.run_cli(flags=("--write",))
        self.assertEqual(json.loads(self.catalog.read_text())["lectures"], [])

    def test_registers_future_course_and_preserves_surgery_baseline(self):
        save(self.root / "draft.json", draft())
        baseline = (self.root / "courses" / "packs" / "surgery-baseline.json").read_bytes()
        self.run_cli(flags=("--write", "--reviewed"))
        entries = json.loads(self.catalog.read_text())["lectures"]
        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0]["courseId"], "internal-medicine")
        self.assertEqual(entries[0]["expectedCounts"]["coreShorts"], 1)
        self.assertEqual(
            json.loads((self.root / "courses" / "packs" / "internal-medicine.json").read_text())["lectureCatalog"],
            "../../lectures/catalog.json",
        )
        self.assertEqual((self.root / "courses" / "packs" / "surgery-baseline.json").read_bytes(), baseline)
        with self.assertRaisesRegex(SystemExit, "already exists"):
            self.run_cli()

    def test_surgery_is_additive_and_does_not_expand_frozen_baseline(self):
        save(self.root / "draft.json", draft("surgery"))
        baseline_file = self.root / "courses" / "packs" / "surgery-baseline.json"
        before = baseline_file.read_bytes()
        self.run_cli(course="surgery", flags=("--write", "--reviewed"))
        self.assertEqual(baseline_file.read_bytes(), before)
        self.assertEqual(json.loads(self.catalog.read_text())["lectures"][0]["courseId"], "surgery")

    def test_rejects_empty_source_and_mismatched_subject(self):
        document = draft()
        document["coreShorts"] = []
        save(self.root / "draft.json", document)
        with self.assertRaisesRegex(SystemExit, "empty lecture"):
            self.run_cli()
        document["coreShorts"] = draft()["coreShorts"]
        document["subject"] = "Urology"
        save(self.root / "draft.json", document)
        with self.assertRaisesRegex(SystemExit, "must match"):
            self.run_cli()

    def test_rejects_unsafe_image_paths_and_missing_files(self):
        doc = draft()
        doc["imageQuestions"] = [{
            "id": "image-1", "title": "Image", "topic": "Overview",
            "priority": "Core", "marks": 1, "subtopics": ["overview"],
            "questions": ["What is shown?"], "answer": ["Source-backed visual"],
            "image": "./assets/../secrets.png"
        }]
        save(self.root / "draft.json", doc)
        with self.assertRaisesRegex(SystemExit, "referenced image does not exist"):
            self.run_cli()

    def test_write_failure_rolls_back_all_published_files(self):
        save(self.root / "draft.json", draft())
        before_catalog = self.catalog.read_bytes()
        before_pack = (self.root / "courses" / "packs" / "internal-medicine.json").read_bytes()
        old_replace = os.replace
        calls = 0

        def fail_second_install(source, target):
            nonlocal calls
            calls += 1
            if calls == 2:
                raise OSError("simulated write failure")
            return old_replace(source, target)

        with patch.object(intake.os, "replace", side_effect=fail_second_install):
            with self.assertRaisesRegex(SystemExit, "previous files restored"):
                self.run_cli(flags=("--write", "--reviewed"))
        self.assertEqual(self.catalog.read_bytes(), before_catalog)
        self.assertEqual((self.root / "courses" / "packs" / "internal-medicine.json").read_bytes(), before_pack)
        self.assertFalse((self.root / "lectures" / "data" / "internal-medicine-test-lecture.json").exists())


if __name__ == "__main__":
    unittest.main()
