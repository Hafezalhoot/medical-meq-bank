"""A published chapter grouping must survive the single-file offline build."""
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import patch
import json
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import finalize_course_packs


class OfflineChapterRegistryTests(TestCase):
    def test_embedding_retains_scoped_lecture_chapters(self):
        with TemporaryDirectory() as directory:
            root=Path(directory)
            packs=root/"courses"/"packs"
            packs.mkdir(parents=True)
            lecture_dir=root/"lectures"
            lecture_dir.mkdir()
            (root/"courses"/"catalog.json").write_text(json.dumps({
                "version":1,"schemaVersion":2,
                "courses":[{"id":"test-course","label":"Test Course","order":1,"pack":"packs/test-course.json"}]
            }),encoding="utf-8")
            (packs/"test-course.json").write_text(json.dumps({
                "version":1,"schemaVersion":2,"id":"test-course",
                "label":"Test Course","order":1,
                "subjects":[{"id":"subject","label":"Subject","order":1,
                    "chapters":[{"id":"chapter","label":"Chapter","order":1}]}],
                "defaultSubject":"subject",
                "lectureCatalog":"../../lectures/catalog.json"
            }),encoding="utf-8")
            (lecture_dir/"catalog.json").write_text(json.dumps({
                "version":1,"schemaVersion":2,
                "lectures":[{"id":"example-lecture","courseId":"test-course",
                    "subjectKey":"subject","chapterId":"chapter"}]
            }),encoding="utf-8")
            with patch.object(finalize_course_packs,"ROOT",root),patch.object(finalize_course_packs,"COURSES",root/"courses"):
                registry=finalize_course_packs.load_embedded_registry()
            self.assertEqual(registry["lectureChapters"],{"example-lecture":"chapter"})
            self.assertEqual(registry["packs"]["test-course"]["subjects"][0]["chapters"][0]["id"],"chapter")
