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


if __name__ == "__main__":
    unittest.main()
