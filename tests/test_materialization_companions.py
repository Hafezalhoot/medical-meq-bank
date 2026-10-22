"""Companion MCQs must be additive to checksum-verified legacy lecture materialization."""

from copy import deepcopy
from pathlib import Path
import json
import sys
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import materialize_lectures as materializer


def fixture():
    return {
        "id": "urology-bladder-cancer",
        "cases": [{"id": "bc-c01"}],
        "coreShorts": [{"id": "bc-s01"}],
        "imageQuestions": [{"id": "bc-i01"}],
        "detailedShorts": [{"id": "bc-d01"}],
        "rapid": [],
    }


def guide(id="bc-mcq-001"):
    return {"mcqs": [{
        "id": id,
        "question": "Which term is in the printed lecture?",
        "options": ["Tis", "Ta", "T1", "T2"],
        "answerIndex": 1,
        "rationale": "The source distinguishes papillary Ta from other stages.",
        "sourcePage": "Original PDF p. 9",
    }]}


class CompanionSafetyTests(unittest.TestCase):
    def setUp(self):
        temp = TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        (self.root / "companions").mkdir(parents=True)
        self.patch = patch.multiple(materializer, LECTURES=self.root, ROOT=self.root)
        self.patch.start()
        self.addCleanup(self.patch.stop)
        self.target = {
            "lectureId": "urology-bladder-cancer",
            "studyGuideCompanion": "companions/urology-bladder-cancer.json",
        }

    def put(self, payload):
        (self.root / "companions" / "urology-bladder-cancer.json").write_text(
            json.dumps(payload), encoding="utf-8"
        )

    def test_adds_verified_mcqs_without_changing_any_legacy_item(self):
        source = fixture()
        old = deepcopy(source)
        self.put({"lectureId": source["id"], "studyGuide": guide()})
        published = materializer.apply_study_guide_companion(source, self.target)
        self.assertEqual(source, old)
        self.assertEqual({k: published[k] for k in old}, old)
        self.assertEqual(published["studyGuide"]["mcqs"][0]["id"], "bc-mcq-001")

    def test_rejects_an_existing_guide_or_colliding_item_id(self):
        self.put({"lectureId": "urology-bladder-cancer", "studyGuide": guide()})
        with self.assertRaisesRegex(SystemExit, "already has a studyGuide"):
            materializer.apply_study_guide_companion({**fixture(), "studyGuide": guide()}, self.target)
        self.put({"lectureId": "urology-bladder-cancer", "studyGuide": guide("bc-c01")})
        with self.assertRaisesRegex(SystemExit, "reuses study item id"):
            materializer.apply_study_guide_companion(fixture(), self.target)

    def test_rejects_wrong_identity_unsafe_path_and_missing_source(self):
        with self.assertRaisesRegex(SystemExit, "missing or unsafe"):
            materializer.apply_study_guide_companion(fixture(), self.target)
        self.put({"lectureId": "another-lecture", "studyGuide": guide()})
        with self.assertRaisesRegex(SystemExit, "different lecture ID"):
            materializer.apply_study_guide_companion(fixture(), self.target)
        with self.assertRaisesRegex(SystemExit, "exact lecture-scoped path"):
            materializer.apply_study_guide_companion(fixture(), {**self.target,
                "studyGuideCompanion": "../other.json"})

    def test_original_lecture_without_companion_is_unchanged(self):
        original = fixture()
        result = materializer.apply_study_guide_companion(original, {"lectureId": original["id"]})
        self.assertIs(result, original)


if __name__ == "__main__":
    unittest.main()
