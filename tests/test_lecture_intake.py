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
            "version": 1,
            "schemaVersion": 2,
            "courses": [
                {"id": "internal-medicine", "label": "Internal Medicine", "order": 2, "pack": "packs/internal-medicine.json"},
                {"id": "surgery", "label": "Surgery", "order": 1, "pack": "packs/surgery.json"},
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

    def test_create_course_dry_run_then_register_without_touching_existing_packs(self):
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "add_course_test_module", ROOT_SOURCE / "tools" / "add_course.py"
        )
        course = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(course)
        course.COURSES = self.root / "courses"
        before = (self.root / "courses" / "packs" / "surgery.json").read_bytes()
        command = [
            "add_course.py", "--id", "pediatrics", "--label", "Pediatrics",
            "--subject", "neonatology=Neonatology",
            "--subject", "pediatric-cardiology=Pediatric Cardiology",
        ]
        with patch.object(sys, "argv", command):
            with redirect_stdout(StringIO()):
                course.main()
        self.assertFalse((self.root / "courses" / "packs" / "pediatrics.json").exists())
        with patch.object(sys, "argv", command + ["--write"]):
            with redirect_stdout(StringIO()):
                course.main()
        saved = json.loads((self.root / "courses" / "packs" / "pediatrics.json").read_text())
        self.assertEqual(saved["defaultSubject"], "neonatology")
        self.assertEqual(len(saved["subjects"]), 2)
        self.assertEqual((self.root / "courses" / "packs" / "surgery.json").read_bytes(), before)
        catalog = json.loads((self.root / "courses" / "catalog.json").read_text())
        self.assertTrue(any(item["id"] == "pediatrics" for item in catalog["courses"]))
        with patch.object(sys, "argv", command + ["--write"]):
            with self.assertRaisesRegex(SystemExit, "course already registered"):
                course.main()

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
        path = self.root / "tmp" / "lecture-drafts" / "internal-medicine-cardiology-cardiac-pharmacology.json"
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


    def test_default_draft_ids_are_unique_across_courses_with_the_same_subject(self):
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "draft_generator_scoped_test_module", ROOT_SOURCE / "tools" / "new_lecture.py"
        )
        generator = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(generator)
        generator.ROOT, generator.LECTURES = self.root, self.root / "lectures"
        generator.course_pack = intake.course_pack
        generator.read_json = intake.read_json

        # A shared specialty exists in more than one medical course.
        surgery_pack = self.root / "courses" / "packs" / "surgery.json"
        pack = json.loads(surgery_pack.read_text(encoding="utf-8"))
        pack["subjects"].append({"id": "cardiology", "label": "Cardiology"})
        save(surgery_pack, pack)

        files = []
        for course in ("internal-medicine", "surgery"):
            with patch.object(sys, "argv", [
                "new_lecture.py", "--course", course, "--subject", "cardiology",
                "--title", "Shared Introduction", "--source", "Source.pdf",
            ]):
                with redirect_stdout(StringIO()):
                    generator.main()
            output = self.root / "tmp" / "lecture-drafts" / (
                f"{course}-cardiology-shared-introduction.json"
            )
            self.assertTrue(output.is_file())
            draft = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual(draft["id"], f"{course}-cardiology-shared-introduction")
            files.append(output)

        self.assertNotEqual(files[0], files[1])
        self.assertEqual(json.loads(self.catalog.read_text())["lectures"], [])

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

    def test_private_original_photo_intake_preserves_source_hash_and_progress_identity(self):
        document = draft()
        fingerprint = "a" * 64
        document["imageQuestions"] = [{
            "id": "original-image-1", "title": "Printed lecture photograph",
            "topic": "Overview", "priority": "Core", "marks": 1,
            "subtopics": ["overview"], "questions": ["What is shown?"],
            "answer": ["Exactly the term in the printed source"],
            "page": "Lecture PDF p. 4", "prompt": "Identify the original image from p. 4.",
            "imageSha256": fingerprint, "imageBytes": 12844,
        }]
        save(self.root / "draft.json", document)
        # Dry-run and verified write must both work WITHOUT requiring any
        # copyrighted medical image to be checked into this public repo.
        self.run_cli()
        self.run_cli(flags=("--write", "--reviewed"))
        result = json.loads(
            (self.root / "lectures" / "data" / "internal-medicine-test-lecture.json").read_text()
        )
        self.assertEqual(result["imageQuestions"][0]["imageSha256"], fingerprint)
        self.assertEqual(result["imageQuestions"][0]["page"], "Lecture PDF p. 4")
        self.assertNotIn("image", result["imageQuestions"][0])
        self.assertEqual(result["imageQuestions"][0]["id"], "original-image-1")

    def test_intake_rejects_inconsistent_or_unreviewed_private_source_image_metadata(self):
        original = {
            "id": "original-image-1", "title": "Source image",
            "topic": "Overview", "priority": "Core", "marks": 1,
            "subtopics": ["overview"], "questions": ["Name the lesion"],
            "answer": ["Printed lecture term"], "page": "Lecture PDF p. 4",
            "prompt": "Use the source photo.", "imageSha256": "f" * 64,
        }
        cases = [
            ({"imageSha256": "0" * 63}, "invalid original PDF imageSha256"),
            ({"imageSha256": "F" * 64}, "invalid original PDF imageSha256"),
            ({"page": ""}, "lecture-page reference|printed source page"),
            ({"prompt": ""}, "source-linked prompt"),
            ({"imageBytes": 1}, "private original-image byte count"),
            ({"imageBytes": True}, "private original-image byte count"),
            ({"imageBytes": 5 * 1024 * 1024 + 1}, "private original-image byte count"),
        ]
        for changes, reason in cases:
            with self.subTest(changes=changes):
                doc = draft()
                doc["imageQuestions"] = [dict(original, **changes)]
                save(self.root / "draft.json", doc)
                with self.assertRaisesRegex(SystemExit, reason):
                    self.run_cli()
                self.assertEqual(json.loads(self.catalog.read_text())["lectures"], [])
        missing = dict(original)
        missing.pop("imageSha256")
        missing["imageBytes"] = 1400
        doc = draft()
        doc["imageQuestions"] = [missing]
        save(self.root / "draft.json", doc)
        with self.assertRaisesRegex(SystemExit, "imageBytes requires an image source"):
            self.run_cli()

    def test_optional_study_guide_is_source_traced_and_schema_checked(self):
        document = draft()
        document["studyGuide"] = {
            "explanation": [{
                "heading": "Definition from PDF",
                "paragraphs": ["Explanation text from source only."],
                "sourcePage": "Slide 3",
                "understandingAids": ["A separately labeled understanding aid."],
            }],
            "mcqs": [{
                "id": "test-mcq-1", "question": "Which approved source choice is correct?",
                "options": ["A", "B", "C", "D"], "answerIndex": 1,
                "rationale": "As stated on the source slide.", "sourcePage": "Slide 4",
            }],
        }
        save(self.root / "draft.json", document)
        self.run_cli()
        self.run_cli(flags=("--write", "--reviewed"))
        stored = json.loads((self.root / "lectures" / "data" / "internal-medicine-test-lecture.json").read_text())
        self.assertEqual(stored["studyGuide"]["mcqs"][0]["answerIndex"], 1)
        self.assertEqual(stored["studyGuide"]["explanation"][0]["sourcePage"], "Slide 3")

    def test_study_guide_rejects_missing_page_and_bad_answer_index(self):
        document = draft()
        document["studyGuide"] = {
            "mcqs": [{
                "id": "test-mcq-1", "question": "Source-backed question?",
                "options": ["A", "B", "C", "D"], "answerIndex": 5,
                "rationale": "From source", "sourcePage": "Slide 4",
            }],
        }
        save(self.root / "draft.json", document)
        with self.assertRaisesRegex(SystemExit, "answerIndex"):
            self.run_cli()
        document["studyGuide"]["mcqs"][0]["answerIndex"] = 1
        document["studyGuide"]["mcqs"][0].pop("sourcePage")
        save(self.root / "draft.json", document)
        with self.assertRaisesRegex(SystemExit, "sourcePage"):
            self.run_cli()

    def test_infographic_must_reference_a_valid_local_asset(self):
        document = draft()
        document["studyGuide"] = {
            "infographic": {
                "image": "https://untrusted.example/figure.png",
                "alt": "Source-backed diagram", "sourcePage": "Slide 8",
            }
        }
        save(self.root / "draft.json", document)
        with self.assertRaisesRegex(SystemExit, "must reference a safe local asset"):
            self.run_cli()
        asset = self.root / "assets" / "lectures" / "figure.png"
        asset.parent.mkdir(parents=True)
        asset.write_bytes(b"test PNG placeholder")
        document["studyGuide"]["infographic"]["image"] = "./assets/lectures/figure.png"
        save(self.root / "draft.json", document)
        self.run_cli()

    def test_standalone_guide_inlines_local_infographic_without_external_dependencies(self):
        from lecture_builder import inline_study_guide_media
        asset = self.root / "assets" / "lectures" / "test.png"
        asset.parent.mkdir(parents=True)
        asset.write_bytes(b"\\x89PNG fixture")
        samples = [{
            "id": "fixture-lecture", "studyGuide": {
                "infographic": {"image": "./assets/lectures/test.png", "alt": "Diagram", "sourcePage": "Slide 4"},
            },
        }]
        inline_study_guide_media(self.root, samples)
        self.assertTrue(samples[0]["studyGuide"]["infographic"]["image"].startswith("data:image/png;base64,"))
        self.assertNotIn("./assets/", samples[0]["studyGuide"]["infographic"]["image"])

    def test_source_authored_svg_media_is_passive_and_offline_safe(self):
        from lecture_builder import validate_safe_svg, inline_study_guide_media
        assets = self.root / "assets" / "lectures"
        assets.mkdir(parents=True)
        diagram = assets / "safe.svg"
        diagram.write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40">'
                           '<rect x="3" y="3" width="20" height="20" fill="#123456"/>'
                           '<text x="30" y="18">Skin</text></svg>', encoding="utf-8")
        self.assertGreater(len(validate_safe_svg(diagram)), 10)
        lecture = {"id": "safe-source", "imageQuestions": [{"image": "./assets/lectures/safe.svg"}],
                   "studyGuide": {"infographic": {"image": "./assets/lectures/safe.svg"}}}
        inline_study_guide_media(self.root, [lecture])
        self.assertTrue(lecture["imageQuestions"][0]["image"].startswith("data:image/svg+xml;base64,"))
        self.assertTrue(lecture["studyGuide"]["infographic"]["image"].startswith("data:image/svg+xml;base64,"))
        diagram.write_text('<svg xmlns="http://www.w3.org/2000/svg"><script>bad()</script></svg>',
                           encoding="utf-8")
        with self.assertRaisesRegex(SystemExit, "unsupported element"):
            validate_safe_svg(diagram)
        diagram.write_text('<!DOCTYPE svg><svg xmlns="http://www.w3.org/2000/svg"/>',
                           encoding="utf-8")
        with self.assertRaisesRegex(SystemExit, "forbidden"):
            validate_safe_svg(diagram)
        diagram.write_text('<svg xmlns="http://www.w3.org/2000/svg">'
                           '<image href="https://example.com/x.png"/></svg>',
                           encoding="utf-8")
        with self.assertRaisesRegex(SystemExit, "unsupported element"):
            validate_safe_svg(diagram)

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
