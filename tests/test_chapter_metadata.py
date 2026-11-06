"""Optional Chapter metadata belongs to course/lecture catalogs, never medical payloads."""
import json
from pathlib import Path
import unittest
from scripts import validate_course_packs as validator

ROOT=Path(__file__).resolve().parents[1]

class ChapterMetadataTests(unittest.TestCase):
    def setUp(self):
        self.subjects=[{"id":"urology","label":"Urology","order":1,
                        "chapters":[{"id":"renal","label":"Renal","order":1},
                                    {"id":"bladder","label":"Bladder","order":2}]}]
        self.lectures=[{"id":"urology-renal-tumors","subjectKey":"urology","chapterId":"renal"}]

    def test_schemas_support_optional_chapters_without_requiring_them(self):
        pack=json.loads((ROOT/"courses/course-pack.schema.json").read_text(encoding="utf-8"))
        chapter=pack["properties"]["subjects"]["items"]["properties"]["chapters"]
        self.assertEqual(chapter["type"],"array")
        self.assertNotIn("chapters",pack["properties"]["subjects"]["items"]["required"])
        cat=json.loads((ROOT/"lectures/catalog.schema.json").read_text(encoding="utf-8"))
        self.assertEqual(cat["properties"]["lectures"]["items"]["properties"]["chapterId"]["type"],"string")
        self.assertNotIn("chapterId",cat["properties"]["lectures"]["items"]["required"])

    def test_valid_and_missing_chapters_preserve_backward_compatibility(self):
        validator.validate_chapter_metadata("surgery",self.subjects,self.lectures)
        validator.validate_chapter_metadata("surgery",
            [{"id":"urology","label":"Urology","order":1}],
            [{"id":"urology-bladder-cancer","subjectKey":"urology"}])

    def test_duplicate_chapter_id_and_order_fail(self):
        for key,duplicate in [("id","renal"),("order",1)]:
            with self.subTest(key=key):
                subjects=json.loads(json.dumps(self.subjects))
                subjects[0]["chapters"][1][key]=duplicate
                with self.assertRaisesRegex(SystemExit,"duplicate chapter"):
                    validator.validate_chapter_metadata("surgery",subjects,self.lectures)

    def test_orphan_or_wrong_subject_chapter_fails(self):
        for assignment in [
            {"id":"case","subjectKey":"urology","chapterId":"nonexistent"},
            {"id":"case","subjectKey":"other","chapterId":"renal"}
        ]:
            with self.subTest(assignment=assignment):
                with self.assertRaisesRegex(SystemExit,"chapter"):
                    validator.validate_chapter_metadata("surgery",self.subjects,[assignment])

    def test_invalid_chapter_id_label_and_order_fail(self):
        for field,value in [("id","Bad Id"),("label","  "),("order",0),
                            ("order",True),("order",float("inf"))]:
            with self.subTest(field=field,value=value):
                data=json.loads(json.dumps(self.subjects))
                data[0]["chapters"][0][field]=value
                with self.assertRaisesRegex(SystemExit,"chapter"):
                    validator.validate_chapter_metadata("surgery",data,self.lectures)

if __name__=="__main__":
    unittest.main()
