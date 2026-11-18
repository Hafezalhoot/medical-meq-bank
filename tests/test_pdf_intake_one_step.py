"""Wizard .intake.json + original PDF → private, source-unreviewed evidence."""
from hashlib import sha256
from pathlib import Path
from tempfile import TemporaryDirectory
import json
import sys
import unittest

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from pdf_source_inventory import SourceInventoryError,create_private_bundle

try:
    import fitz
except ImportError:
    fitz=None

@unittest.skipIf(fitz is None,'Optional private PDF intake requires PyMuPDF')
class OneStepIntakeTests(unittest.TestCase):
    def setUp(self):
        self.tmp=TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name)
        self.pdf=self.root/'Original Synthetic.pdf'
        with fitz.open() as doc:
            doc.new_page().insert_text((50,80),'Only nonmedical source notes')
            doc.new_page().draw_line((50,50),(120,70))
            doc.save(self.pdf)
        self.intake=self.root/'request.intake.json'
        self.data={'format':'medical-library-intake','version':1,'status':'needs-source-review',
           'lecture':{
             'course':'surgery','subject':'urology',
             'title':'Synthetic one-step private review test',
             'id':'surgery-urology-private-review-one-step-test',
             'order':9999,'source':self.pdf.name,
             'topics':[{'id':'topic-1','label':'Introduction | notes'},
                       {'id':'topic-2','label':'Source visual notes'}],
           }}
        self.save()

    def save(self):
        self.intake.write_text(json.dumps(self.data,ensure_ascii=False),encoding='utf-8')

    def test_one_command_generates_valid_private_unpublished_draft_and_topic_map(self):
        output=self.root/'private-evidence'
        result=create_private_bundle(self.pdf,output,intake_path=self.intake,render_pages=True)
        self.assertEqual(result['pageCount'],2)
        self.assertEqual(result['sourceSha256'],sha256(self.pdf.read_bytes()).hexdigest())
        self.assertEqual(result['intakeSha256'],sha256(self.intake.read_bytes()).hexdigest())
        self.assertEqual((output/'intake-request.json').read_bytes(),self.intake.read_bytes())
        draft=json.loads((output/'lecture-draft.json').read_text(encoding='utf-8'))
        self.assertEqual([t['id'] for t in draft['subtopics']],['topic-1','topic-2'])
        self.assertEqual(draft['cases'],[])
        self.assertTrue((output/'review.md').is_file())
        mapping=(output/'source-topic-map.md').read_text(encoding='utf-8')
        self.assertIn('Introduction \\| notes',mapping)
        self.assertIn('PDF page(s) to verify',mapping)
        self.assertEqual(mapping.count('Not assigned'),2)
        self.assertIn('topic-2',mapping)
        self.assertNotIn('[x]',mapping.lower())
        self.assertEqual(len(list((output/'page-previews').glob('*.png'))),2)
        with self.assertRaisesRegex(SourceInventoryError,'already exists'):
            create_private_bundle(self.pdf,output,intake_path=self.intake)

    def test_wrong_filename_and_approval_claim_rejected_without_writing(self):
        self.data['lecture']['source']='Wrong.pdf';self.save()
        with self.assertRaisesRegex(SourceInventoryError,'source PDF'):
            create_private_bundle(self.pdf,self.root/'wrong',intake_path=self.intake)
        self.assertFalse((self.root/'wrong').exists())
        self.data['lecture']['source']=self.pdf.name
        self.data['status']='approved';self.save()
        with self.assertRaises(SourceInventoryError):
            create_private_bundle(self.pdf,self.root/'fake',intake_path=self.intake)
        self.assertFalse((self.root/'fake').exists())

    def test_rejects_duplicate_topics_and_oversized_request(self):
        self.data['lecture']['topics'][1]['label']='  Introduction | NOTES '
        self.save()
        with self.assertRaises(SourceInventoryError):
            create_private_bundle(self.pdf,self.root/'dup',intake_path=self.intake)
        self.assertFalse((self.root/'dup').exists())
        self.intake.write_text(' '*(128*1024+1),encoding='utf-8')
        with self.assertRaisesRegex(SourceInventoryError,'128 KB'):
            create_private_bundle(self.pdf,self.root/'oversized',intake_path=self.intake)

    def test_requires_either_draft_or_intake_never_both(self):
        with self.assertRaisesRegex(SourceInventoryError,'one'):
            create_private_bundle(self.pdf,self.root/'both',draft_path=self.intake,intake_path=self.intake)
        self.assertFalse((self.root/'both').exists())
