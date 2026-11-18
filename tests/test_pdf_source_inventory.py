"""Private PDF source-inventory tests. Synthetic PDFs contain no medical claims."""
from hashlib import sha256
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import mock
import json
import sys
import unittest

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from pdf_source_inventory import (
    inventory_pdf, create_private_bundle, SourceInventoryError,
    load_matching_draft, source_index_markdown,
)
try:
    import fitz
except ImportError:
    fitz=None


class SourceManifestSafetyTests(unittest.TestCase):
    def test_source_review_remains_unchecked(self):
        sample={
            'sourceFilename':'Sample.pdf','sourceSha256':'f'*64,'pageCount':1,
            'pages':[{'page':1,'nativeTextCharacters':0,
                      'embeddedImages':[],'vectorDrawingPaths':4}],
        }
        note=source_index_markdown(sample)
        self.assertIn('| 1 | 0 | 0 | 4 | [ ] Inspect source + figures |',note)
        self.assertIn('NEEDS SOURCE REVIEW',note)
        self.assertNotIn('[x]',note.lower())
        self.assertNotIn('correctAnswer',note)

    def test_mismatched_original_source_name_is_rejected(self):
        with TemporaryDirectory() as folder:
            file=Path(folder)/'draft.json'
            file.write_text(json.dumps({
                'id':'source-fixture','sourceNote':'PDF source: Wrong.pdf;',
                'cases':[],'coreShorts':[],'imageQuestions':[],
                'detailedShorts':[],'rapid':[],
            }))
            with self.assertRaisesRegex(SourceInventoryError,'different source PDF'):
                load_matching_draft(file,'Right.pdf')


@unittest.skipIf(fitz is None,'Optional private PDF intake requires PyMuPDF')
class PdfSourceInventoryTests(unittest.TestCase):
    def setUp(self):
        self.tmp=TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.folder=Path(self.tmp.name)
        self.pdf=self.folder/'Sample Lecture.pdf'
        with fitz.open() as document:
            page=document.new_page()
            page.insert_text((72,90),'Page one: synthetic source text only')
            page=document.new_page()
            pix=fitz.Pixmap(fitz.csRGB,fitz.IRect(0,0,16,16),False)
            pix.clear_with(255);pix.set_pixel(1,1,(255,0,0))
            page.insert_image(fitz.Rect(50,50,95,95),stream=pix.tobytes('png'))
            document.new_page()
            document.save(self.pdf)

    def test_source_hash_and_all_page_classes(self):
        data=inventory_pdf(self.pdf)
        self.assertEqual(data['pageCount'],3)
        self.assertEqual(data['sourceSha256'],sha256(self.pdf.read_bytes()).hexdigest())
        self.assertIn('Page one',data['pages'][0]['nativeText'])
        self.assertEqual(data['pages'][1]['nativeText'].strip(),'')
        self.assertEqual(len(data['pages'][1]['embeddedImages']),1)
        self.assertEqual(data['pages'][2]['reviewState'],'needs-visual-review')
        self.assertTrue(all(page['reviewRequired'] for page in data['pages']))
        self.assertFalse(data['approved'])
        self.assertEqual(data['status'],'needs-source-review')

    def test_private_bundle_original_images_and_review_remain_source_only(self):
        destination=self.folder/'private-bundle'
        draft=self.folder/'draft.json'
        record={
            'id':'fake-surgery-urology-lecture','title':'Source-only fixture',
            'sourceNote':'PDF source: Sample Lecture.pdf; review slide/page references before approval.',
            'cases':[],'coreShorts':[],'imageQuestions':[],'detailedShorts':[],'rapid':[],
        }
        draft.write_text(json.dumps(record),encoding='utf-8')
        inventory=create_private_bundle(
            self.pdf,destination,draft_path=draft,render_pages=True,extract_images=True,
        )
        self.assertEqual(inventory['pageCount'],3)
        for path in ('source-inventory.json','source-index.md','review.md',
                     'source-pages/page-0001.txt','source-pages/page-0002.txt',
                     'lecture-draft.json'):
            self.assertTrue((destination/path).is_file(),path)
        self.assertEqual(len(list((destination/'page-previews').glob('*.png'))),3)
        images=list((destination/'original-images').glob('*'))
        self.assertEqual(len(images),1)
        source=inventory['pages'][1]['embeddedImages'][0]
        self.assertEqual(sha256(images[0].read_bytes()).hexdigest(),source['sha256'])
        review=(destination/'review.md').read_text(encoding='utf-8')
        self.assertIn('NEEDS SOURCE REVIEW',review)
        self.assertIn('PDF p.1',review)
        self.assertIn('PDF p.3',review)
        self.assertNotIn('[x]',review.lower())
        with self.assertRaisesRegex(SourceInventoryError,'already exists'):
            create_private_bundle(self.pdf,destination,draft_path=draft)
        record['sourceNote']='PDF source: Another.pdf; review before approval.'
        draft.write_text(json.dumps(record),encoding='utf-8')
        with self.assertRaisesRegex(SourceInventoryError,'different source PDF'):
            create_private_bundle(self.pdf,self.folder/'wrong',draft_path=draft)
        self.assertFalse((self.folder/'wrong').exists())

    def test_invalid_and_encrypted_pdf_rejected(self):
        fake=self.folder/'fake.pdf';fake.write_text('Not really PDF'*30)
        with self.assertRaisesRegex(SourceInventoryError,'PDF header'):
            inventory_pdf(fake)
        with self.assertRaisesRegex(SourceInventoryError,'PDF filename'):
            inventory_pdf(self.folder/'fake.txt')
        locked=self.folder/'locked.pdf'
        with fitz.open() as document:
            page=document.new_page();page.insert_text((40,40),'private fixture')
            document.save(locked,encryption=fitz.PDF_ENCRYPT_AES_256,
                          user_pw='reader',owner_pw='owner')
        with self.assertRaisesRegex(SourceInventoryError,'Password-protected'):
            inventory_pdf(locked)

    def test_never_write_into_tracked_repository_paths(self):
        import pdf_source_inventory as inventory
        with mock.patch.object(inventory,'ROOT',self.folder):
            with self.assertRaisesRegex(SourceInventoryError,'private tmp'):
                create_private_bundle(self.pdf,self.folder/'assets'/'published')
            self.assertFalse((self.folder/'assets'/'published').exists())


if __name__=='__main__':
    unittest.main()
