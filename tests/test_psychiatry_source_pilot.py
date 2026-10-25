"""Source/page provenance checks for the two Internal Medicine II Psychiatry drafts.

These are structural checks, not medical editorial signoff.
"""
import json
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
COURSE = "internal-medicine-ii"
CASES = {
    "internal-medicine-ii-psychiatry-psychiatric-history-mse": (44, 42),
    "internal-medicine-ii-psychiatry-anxiety-disorders": (43, 47),
}
PAGE = re.compile(r"^PDF p\.(\d+)$")


class PsychiatrySourcePilotTests(unittest.TestCase):
    def test_catalog_subject_and_source_refs_are_complete(self):
        pack = json.loads((ROOT / "courses/packs/internal-medicine-ii.json").read_text(encoding="utf-8"))
        subjects = [subject["id"] for subject in pack["subjects"]]
        self.assertIn("dermatology", subjects, "Existing Dermatology course must be preserved")
        self.assertIn("psychiatry", subjects)

        catalog = json.loads((ROOT / "lectures/catalog.json").read_text(encoding="utf-8"))
        entries = {row["id"]: row for row in catalog["lectures"]}
        for lecture_id, (max_page, expected_mcqs) in CASES.items():
            with self.subTest(lecture=lecture_id):
                self.assertIn(lecture_id, entries)
                item = entries[lecture_id]
                self.assertEqual(item["courseId"], COURSE)
                self.assertEqual(item["subjectKey"], "psychiatry")
                source = ROOT / "lectures" / item["file"]
                self.assertTrue(source.is_file(), "Lecture must be registered by real JSON")
                lecture = json.loads(source.read_text(encoding="utf-8"))
                self.assertEqual(lecture["id"], lecture_id)
                self.assertIn("SHA-256", lecture["sourceNote"])
                self.assertEqual(lecture["subjectKey"], "psychiatry")
                for key in ("cases", "coreShorts", "imageQuestions", "detailedShorts", "rapid"):
                    self.assertEqual(len(lecture[key]), item["expectedCounts"][key])
                guide = lecture["studyGuide"]
                self.assertEqual(len(guide["mcqs"]), expected_mcqs)
                self.assertTrue(guide["explanation"])
                refs = [v["sourcePage"] for v in guide["mcqs"] + guide["explanation"]]
                refs += [v["page"] for v in lecture["imageQuestions"]]
                for ref in refs:
                    match = PAGE.fullmatch(ref)
                    self.assertIsNotNone(match, f"Malformed PDF page reference: {ref}")
                    self.assertTrue(1 <= int(match.group(1)) <= max_page, ref)
                for q in lecture["coreShorts"] + lecture["detailedShorts"]:
                    match = re.fullmatch(r"Source PDF p\.(\d+)", q["section"])
                    self.assertIsNotNone(match)
                    self.assertTrue(1 <= int(match.group(1)) <= max_page)
                indices = [0, 0, 0, 0]
                used_ids = set()
                for mcq in guide["mcqs"]:
                    self.assertNotIn(mcq["id"], used_ids)
                    used_ids.add(mcq["id"])
                    self.assertEqual(len(mcq["options"]), 4)
                    self.assertEqual(len(set(mcq["options"])), 4)
                    indices[mcq["answerIndex"]] += 1
                self.assertLessEqual(max(indices) - min(indices), 1,
                    "No predictable single correct-answer position in exam mode")
                self.assertTrue(all("image" not in q for q in lecture["imageQuestions"]),
                    "Source figures must not be silently republished from copyrighted PDFs")


if __name__ == "__main__":
    unittest.main()
