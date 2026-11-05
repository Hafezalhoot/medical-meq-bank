"""Evidence-only review reports must not silently imply medical approval."""

import hashlib
import json
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import lecture_review_report as intake_report


class IntakeReportTests(unittest.TestCase):
    def test_page_coverage_and_missing_sources(self):
        lecture = {
            "id": "surgery-urology-test", "title": "Source | Lecture", "sourceNote": "PDF p.1–4",
            "cases": [{"id": "case-1"}], "coreShorts": [], "imageQuestions": [{"id": "spot-1", "page": "PDF p.4"}],
            "detailedShorts": [], "rapid": [],
            "studyGuide": {
                "explanation": [{"heading": "Introduction", "sourcePage": "PDF p.1"}],
                "mcqs": [{"id": "mcq-1", "sourcePage": "PDF p.2"}, {"id": "mcq-2"}],
            },
        }
        report = intake_report.build_report(lecture, "source.pdf", "a" * 64, 4)
        self.assertIn("NEEDS SOURCE REVIEW", report)
        self.assertIn("Source \\| Lecture", report)
        self.assertIn("mcq-2 | MISSING", report)
        self.assertIn("PDF p.4", report)
        self.assertIn("SHA-256", report)
        self.assertIn("public redistribution rights", report)

    def test_page_by_page_review_never_claims_source_coverage(self):
        lecture = {
            "id": "dermatology-example", "title": "Example lecture",
            "cases": [], "coreShorts": [], "detailedShorts": [], "rapid": [],
            "imageQuestions": [{"id": "spot-1", "page": "PDF p.4"}],
            "studyGuide": {
                "explanation": [{"heading": "Introduction", "sourcePage": "PDF p.1"}],
                "mcqs": [{"id": "mcq-1", "sourcePage": "PDF p.2"}],
                "infographic": {"sourcePage": "PDF p.5"},
            },
        }
        report = intake_report.build_report(lecture, page_count=5)
        self.assertIn("## Page-by-page source inspection", report)
        self.assertIn("Authored links are NOT verified content coverage", report)
        self.assertIn("Text/definitions", report)
        self.assertIn("Images/legends", report)
        self.assertIn("Tables/graphs", report)
        rows = [line for line in report.splitlines() if line.startswith("| PDF p.")]
        self.assertEqual(len(rows), 5)
        self.assertIn("| PDF p.1 | explanation: Introduction | [ ] | [ ] | [ ] |", rows)
        self.assertIn("| PDF p.2 | mcqs: mcq-1 | [ ] | [ ] | [ ] |", rows)
        self.assertIn("| PDF p.3 | No mapped item — inspect this page | [ ] | [ ] | [ ] |", rows)
        self.assertIn("| PDF p.4 | imageQuestions: spot-1 | [ ] | [ ] | [ ] |", rows)
        self.assertIn("| PDF p.5 | infographic: Source figure | [ ] | [ ] | [ ] |", rows)
        self.assertIn("All page checks start unchecked", report)
        self.assertIn("Figure captions, embedded text and annotations", report)
        self.assertNotIn("5 pages verified", report)

    def test_page_audit_flags_unmappable_and_out_of_range_citations(self):
        lecture = {
            "title": "Coverage audit",
            "imageQuestions": [{"id": "source-2", "page": 2}],
            "studyGuide": {"mcqs": [
                {"id": "range", "sourcePage": "PDF pp. 2-4"},
                {"id": "too-high", "sourcePage": "PDF p.8"},
                {"id": "unlabeled", "sourcePage": "Figure B, handout"},
            ]},
        }
        report = intake_report.build_report(lecture, page_count=4)
        self.assertIn("| PDF p.2 | imageQuestions: source-2 | [ ] | [ ] | [ ] |", report)
        self.assertIn("Ambiguous/unmapped page label: mcqs: range — PDF pp. 2-4", report)
        self.assertIn("Out-of-range source page: mcqs: too-high — PDF p.8", report)
        self.assertIn("Ambiguous/unmapped page label: mcqs: unlabeled — Figure B, handout", report)
        self.assertIn("| PDF p.3 | No mapped item — inspect this page | [ ] | [ ] | [ ] |", report)
        self.assertNotIn("mcqs: range | [ ]", report)

    def test_audit_requires_explicit_valid_page_count_for_full_page_review(self):
        report = intake_report.build_report({"title": "One lecture"})
        self.assertIn("Page-by-page inspection unavailable until a reviewer supplies --page-count", report)
        for bad in (True, 0, -1, "4", 2.5):
            with self.subTest(bad=bad), self.assertRaisesRegex(SystemExit, "page_count must be"):
                intake_report.build_report({"title": "One lecture"}, page_count=bad)

    def test_empty_draft_is_not_ready(self):
        report = intake_report.build_report({"title": "Draft"})
        self.assertIn("automatic scoring is unavailable", report)
        self.assertIn("No page-linked items yet", report)
        self.assertIn("not an approval", report)

    def test_pdf_hash_and_exclusive_report_creation(self):
        with TemporaryDirectory() as folder:
            root = Path(folder)
            pdf = root / "source.pdf"
            payload = b"%PDF-1.4\nfixture"
            pdf.write_bytes(payload)
            self.assertEqual(intake_report.pdf_fingerprint(pdf), hashlib.sha256(payload).hexdigest())
            data = root / "lecture.json"
            data.write_text(json.dumps({"title": "Test"}), encoding="utf-8")
            report = root / "review.md"
            args = ["lecture_review_report.py", str(data), "--pdf", str(pdf), "--output", str(report)]
            with patch.object(sys, "argv", args):
                intake_report.main()
            first = report.read_bytes()
            with patch.object(sys, "argv", args), self.assertRaisesRegex(SystemExit, "already exists"):
                intake_report.main()
            self.assertEqual(report.read_bytes(), first)
            with self.assertRaisesRegex(SystemExit, "existing local PDF"):
                intake_report.pdf_fingerprint(root / "missing.pdf")


    def test_verify_requires_all_pages_and_manual_signoffs(self):
        lecture = {
            "id": "draft-one", "title": "Source-only",
            "imageQuestions": [{"id": "spot", "page": 2}],
            "studyGuide": {"explanation": [{"heading": "Overview", "sourcePage": "PDF p.1"}]},
        }
        report = intake_report.build_report(lecture, "source.pdf", "a" * 64, 2, draft_hash="b" * 64)
        complete = report.replace("[ ]", "[x]")
        intake_report.verify_report(report_text=complete, lecture=lecture,
                                    pdf_name="source.pdf", pdf_hash="a" * 64,
                                    page_count=2, draft_hash="b" * 64)
        with self.assertRaisesRegex(SystemExit, "unchecked"):
            intake_report.verify_report(report_text=report, lecture=lecture,
                                        pdf_name="source.pdf", pdf_hash="a" * 64,
                                        page_count=2, draft_hash="b" * 64)
        self.assertIn("NEEDS SOURCE REVIEW", complete)

    def test_verify_rejects_stale_draft_or_pdf_and_modified_worksheet(self):
        lecture = {"id": "draft-one", "title": "Example",
                   "studyGuide": {"mcqs": [{"id": "one", "sourcePage": "PDF p.1"}]}}
        original = intake_report.build_report(lecture, "source.pdf", "a" * 64, 1,
                                              draft_hash="b" * 64).replace("[ ]", "[x]")
        cases = (
            (lecture | {"title": "Modified"}, "a" * 64, "b" * 64, original),
            (lecture, "c" * 64, "b" * 64, original),
            (lecture, "a" * 64, "d" * 64, original),
            (lecture, "a" * 64, "b" * 64, original.replace("Example", "Edited")),
        )
        for draft, pdf_hash, draft_hash, report in cases:
            with self.subTest(draft=draft, pdf_hash=pdf_hash, draft_hash=draft_hash):
                with self.assertRaisesRegex(SystemExit, "stale|altered"):
                    intake_report.verify_report(report, draft, "source.pdf", pdf_hash, 1, draft_hash)

    def test_verify_rejects_missing_or_ambiguous_source_page_and_page_count(self):
        lecture = {"title": "Invalid", "studyGuide": {"mcqs": [{"id": "one", "sourcePage": "PDF pp.1-2"}]}}
        report = intake_report.build_report(lecture, "source.pdf", "a" * 64, 2,
                                             draft_hash="b" * 64).replace("[ ]", "[x]")
        with self.assertRaisesRegex(SystemExit, "unresolved"):
            intake_report.verify_report(report, lecture, "source.pdf", "a" * 64, 2, "b" * 64)
        missing = {"title": "No citation", "studyGuide": {"mcqs": [{"id": "one"}]}}
        missing_report = intake_report.build_report(missing, "source.pdf", "a" * 64, 2,
                                                     draft_hash="b" * 64).replace("[ ]", "[x]")
        with self.assertRaisesRegex(SystemExit, "unresolved"):
            intake_report.verify_report(missing_report, missing, "source.pdf", "a" * 64, 2, "b" * 64)
        with self.assertRaisesRegex(SystemExit, "page count"):
            intake_report.verify_report(report, lecture, "source.pdf", "a" * 64, None, "b" * 64)

    def test_cli_verification_is_read_only_and_checks_original_pdf_hash(self):
        with TemporaryDirectory() as folder:
            root = Path(folder)
            draft = root / "lecture.json"
            lecture = {"title": "Test", "studyGuide": {"mcqs": [{"id": "one", "sourcePage": "PDF p.1"}]}}
            draft.write_text(json.dumps(lecture), encoding="utf-8")
            pdf = root / "original.pdf"
            pdf.write_bytes(b"%PDF-1.4\\nfixture")
            report = root / "review.md"
            with patch.object(sys, "argv", ["lecture_review_report.py", str(draft),
                                            "--pdf", str(pdf), "--page-count", "1",
                                            "--output", str(report)]):
                intake_report.main()
            original = report.read_text(encoding="utf-8")
            self.assertIn("Draft JSON SHA-256", original)
            report.write_text(original.replace("[ ]", "[x]"), encoding="utf-8")
            with patch.object(sys, "argv", ["lecture_review_report.py", str(draft),
                                            "--pdf", str(pdf), "--page-count", "1",
                                            "--verify", str(report)]):
                intake_report.main()
            self.assertEqual(draft.read_text(encoding="utf-8"), json.dumps(lecture))
            pdf.write_bytes(b"%PDF-1.4\\nchanged")
            with patch.object(sys, "argv", ["lecture_review_report.py", str(draft),
                                            "--pdf", str(pdf), "--page-count", "1",
                                            "--verify", str(report)]):
                with self.assertRaisesRegex(SystemExit, "stale|altered"):
                    intake_report.main()



if __name__ == "__main__":
    unittest.main()
