"""Browser intake remains metadata-only and cannot overwrite or publish content."""
import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))


def intake():
    return {'format': 'medical-library-intake', 'version': 1, 'status': 'needs-source-review',
            'lecture': {'course': 'surgery', 'subject': 'urology', 'title': 'New source lecture',
                        'id': 'surgery-urology-new-source', 'order': 9, 'source': 'original.pdf',
                        'topics': [{'id': 'topic-1', 'label': 'Definitions'},
                                   {'id': 'topic-2', 'label': 'الأسباب'}]}}


class LibraryIntakeTests(unittest.TestCase):
    def test_metadata_export_becomes_empty_draft_with_original_topic_labels(self):
        import import_library_draft as tool
        draft = tool.prepare_intake(intake())
        self.assertEqual(draft['subtopics'], [{'id':'topic-1','label':'Definitions'}, {'id':'topic-2','label':'الأسباب'}])
        self.assertEqual(draft['courseId'], 'surgery')
        for key in ('cases', 'coreShorts', 'imageQuestions', 'detailedShorts', 'rapid'):
            self.assertEqual(draft[key], [])
        self.assertNotIn('studyGuide', draft)

    def test_rejects_unknown_content_approval_paths_and_collisions(self):
        import import_library_draft as tool
        changes = [
            {'title':'  bladder   cancer '}, {'id':'urology-bladder-cancer'}, {'order':1},
            {'order':True}, {'id':'surgery-urology-broken--id'}, {'id':'surgery-urology-broken-'},
            {'source':'../private.pdf'}, {'source':'C:\\private.pdf'},
            {'source':'not-pdf.txt'}, {'source':'bad\nname.pdf'}, {'chapterId':'unknown'},
            {'topics':[{'id':'a','label':'Definition'}, {'id':'b','label':' definition '}]},
            {'topics':[{'id':'a','label':'First'}, {'id':'a','label':'Second'}]},
            {'topics':[]}, {'answer':'unreviewed'}, {'course':'unknown'}, {'subject':'cardiology'},
        ]
        for changeset in changes:
            with self.subTest(changes=changeset):
                document=intake(); document['lecture'].update(changeset)
                with self.assertRaises(SystemExit):tool.prepare_intake(document)
        for changeset in ({'status':'approved'}, {'version':True}, {'extra':True}):
            document=intake();document.update(changeset)
            with self.assertRaises(SystemExit):tool.prepare_intake(document)

    def test_existing_chapter_is_subject_scoped_and_preserved_as_draft_metadata(self):
        import import_library_draft as tool
        from unittest.mock import patch
        pack={'id':'surgery','subjects':[{'id':'urology','label':'Urology','chapters':[{'id':'basics','label':'Basics','order':1}]}]}
        document=intake();document['lecture']['chapterId']='basics'
        with patch.object(tool, 'course_pack', return_value=(Path('unused'),pack)):
            self.assertEqual(tool.prepare_intake(document)['chapterId'],'basics')

    def test_cli_defaults_to_preview_and_refuses_overwrite(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory);source=path/'intake.json';output=path/'drafts'
            source.write_text(json.dumps(intake()),encoding='utf8')
            cmd=[sys.executable,str(ROOT/'tools/import_library_draft.py'),str(source),'--output-dir',str(output)]
            preview=subprocess.run(cmd,cwd=ROOT,capture_output=True,text=True)
            self.assertEqual(preview.returncode,0,preview.stderr)
            self.assertFalse(output.exists())
            created=subprocess.run(cmd+['--write'],cwd=ROOT,capture_output=True,text=True)
            self.assertEqual(created.returncode,0,created.stderr)
            target=output/'surgery-urology-new-source.json';previous=target.read_bytes()
            retry=subprocess.run(cmd+['--write'],cwd=ROOT,capture_output=True,text=True)
            self.assertNotEqual(retry.returncode,0)
            self.assertEqual(target.read_bytes(),previous)
            refusal=subprocess.run([sys.executable,str(ROOT/'tools/add_lecture.py'),str(target),'--course','surgery','--write','--reviewed'],cwd=ROOT,capture_output=True,text=True)
            self.assertNotEqual(refusal.returncode,0)
            self.assertIn('empty lecture',refusal.stderr)
