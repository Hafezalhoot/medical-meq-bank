"""Optional Chapter metadata: never changes clinical lecture payloads or progress keys."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from validate_course_packs import validate_chapter_mapping


def course_pack():
    return {"id": "surgery", "subjects": [
        {"id": "urology", "label": "Urology", "order": 1},
        {"id": "neurosurgery", "label": "Neurosurgery", "order": 2},
    ]}


class OptionalChapterMetadataTests(unittest.TestCase):
    def test_existing_subjects_without_chapters_accept_all_unassigned_lectures(self):
        validate_chapter_mapping(course_pack(), [
            {"id": "urology-bladder-cancer", "subjectKey": "urology"},
            {"id": "neurosurgery-tbi", "subjectKey": "neurosurgery"},
        ])

    def test_chapter_mapping_accepts_valid_scoped_groups_and_unassigned(self):
        pack = course_pack()
        pack["subjects"][0]["chapters"] = [
            {"id": "foundation", "label": "Foundations", "order": 1},
            {"id": "oncology", "label": "Urologic Oncology", "order": 2},
        ]
        validate_chapter_mapping(pack, [
            {"id": "intro", "subjectKey": "urology", "chapterId": "foundation"},
            {"id": "cancer", "subjectKey": "urology", "chapterId": "oncology"},
            {"id": "stone", "subjectKey": "urology"},
        ])

    def test_rejects_duplicate_chapter_ids(self):
        pack = course_pack()
        pack["subjects"][0]["chapters"] = [
            {"id": "first", "label": "A", "order": 1},
            {"id": "first", "label": "B", "order": 2},
        ]
        with self.assertRaisesRegex(SystemExit, "duplicate chapter id"):
            validate_chapter_mapping(pack, [])

    def test_rejects_duplicate_order(self):
        pack = course_pack()
        pack["subjects"][0]["chapters"] = [
            {"id": "first", "label": "A", "order": 1},
            {"id": "second", "label": "B", "order": 1},
        ]
        with self.assertRaisesRegex(SystemExit, "duplicate chapter order"):
            validate_chapter_mapping(pack, [])

    def test_rejects_invalid_chapter_label_or_id(self):
        pack = course_pack()
        pack["subjects"][0]["chapters"] = [
            {"id": "../bad", "label": "No", "order": 1},
        ]
        with self.assertRaisesRegex(SystemExit, "invalid chapter"):
            validate_chapter_mapping(pack, [])
        pack["subjects"][0]["chapters"] = [
            {"id": "valid", "label": "   ", "order": 1},
        ]
        with self.assertRaisesRegex(SystemExit, "invalid chapter"):
            validate_chapter_mapping(pack, [])

    def test_rejects_orphan_and_cross_subject_chapter_reference(self):
        pack = course_pack()
        pack["subjects"][0]["chapters"] = [
            {"id": "oncology", "label": "Urologic Oncology", "order": 1},
        ]
        for lecture in (
            {"id": "orphan", "subjectKey": "urology", "chapterId": "not-a-chapter"},
            {"id": "wrong-scope", "subjectKey": "neurosurgery", "chapterId": "oncology"},
        ):
            with self.subTest(lecture=lecture["id"]):
                with self.assertRaisesRegex(SystemExit, "unknown chapter"):
                    validate_chapter_mapping(pack, [lecture])

    def test_rejects_malformed_chapter_container(self):
        pack = course_pack()
        pack["subjects"][0]["chapters"] = "not a list"
        with self.assertRaisesRegex(SystemExit, "chapters must be a list"):
            validate_chapter_mapping(pack, [])


if __name__ == "__main__":
    unittest.main()
