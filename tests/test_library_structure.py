"""Source-neutral hierarchy draft importer: no medical payload or progress-key mutations."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from import_library_structure import prepare_change, prepare_material_change

class StructureDraftTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name)
        (self.root/'packs').mkdir()
        (self.root/'catalog.json').write_text(json.dumps({
            'schemaVersion':2,'version':1,
            'courses':[{'id':'surgery','label':'Surgery','pack':'packs/surgery.json','order':1}]
        }),encoding='utf-8')
        (self.root/'packs/surgery.json').write_text(json.dumps({
            'schemaVersion':2,'version':1,'id':'surgery','label':'Surgery',
            'order':1,'defaultSubject':'urology',
            'subjects':[{'id':'urology','label':'Urology','order':1}]
        }),encoding='utf-8')
    def draft(self,kind='chapter',name='Oncology',ident='oncology'):
        data={'format':'medical-library-structure-intake','version':1,'status':'needs-review',
              'kind':kind,'course':'surgery','item':{'id':ident,'label':name}}
        if kind=='chapter': data['subject']='urology'
        return data
    def test_chapter_is_dry_run_and_preserves_other_data(self):
        path,pack=prepare_change(self.draft(),self.root)
        self.assertEqual(path,self.root/'packs/surgery.json')
        self.assertEqual(pack['subjects'][0]['chapters'],[{'id':'oncology','label':'Oncology','order':1}])
        self.assertNotIn('chapters',json.loads(path.read_text())['subjects'][0])
    def test_specialty_adds_only_metadata(self):
        _,pack=prepare_change(self.draft('specialty','Nephrology','nephrology'),self.root)
        self.assertEqual(pack['subjects'][-1],{'id':'nephrology','label':'Nephrology','order':2})
        self.assertEqual(pack['defaultSubject'],'urology')
    def test_duplicate_id_or_label_rejected(self):
        for kind in ('chapter','specialty'):
            entry=self.draft(kind,'Urology' if kind=='specialty' else 'Oncology',
                             'urology' if kind=='specialty' else 'oncology')
            if kind=='chapter':
                pack=json.loads((self.root/'packs/surgery.json').read_text())
                pack['subjects'][0]['chapters']=[{'id':'oncology','label':'Oncology','order':1}]
                (self.root/'packs/surgery.json').write_text(json.dumps(pack))
            with self.assertRaisesRegex(SystemExit,'already exists'):
                prepare_change(entry,self.root)
    def test_reject_unknown_fields_unsafe_ids_cross_course(self):
        for draft in (
            {**self.draft(),'approval':'approved'},
            self.draft(ident='../traverse'),
            {**self.draft(),'subject':'neurology'},
            {**self.draft(),'course':'missing'},
        ):
            with self.subTest(draft=draft),self.assertRaises(SystemExit):
                prepare_change(draft,self.root)
    def test_new_material_dry_run_creates_catalog_and_pack_in_memory_only(self):
        request={'format':'medical-library-structure-intake','version':1,'status':'needs-review',
                 'kind':'material','item':{'id':'pediatrics','label':'Pediatrics'},
                 'firstSubject':{'id':'neonatology','label':'Neonatology'}}
        changes=prepare_material_change(request,self.root)
        self.assertEqual(set(changes),{self.root/'catalog.json',self.root/'packs/pediatrics.json'})
        catalog=json.loads(changes[self.root/'catalog.json'])
        pack=json.loads(changes[self.root/'packs/pediatrics.json'])
        self.assertEqual(catalog['courses'][-1]['id'],'pediatrics')
        self.assertEqual(pack['defaultSubject'],'neonatology')
        self.assertEqual(pack['subjects'],[{'id':'neonatology','label':'Neonatology','order':1}])
        self.assertFalse((self.root/'packs/pediatrics.json').exists())
        self.assertEqual(len(json.loads((self.root/'catalog.json').read_text())['courses']),1)

    def test_new_material_rejects_duplicates_or_injected_fields(self):
        request={'format':'medical-library-structure-intake','version':1,'status':'needs-review',
                 'kind':'material','item':{'id':'surgery','label':'Surgery'},
                 'firstSubject':{'id':'neonatology','label':'Neonatology'}}
        with self.assertRaisesRegex(SystemExit,'already exists'):
            prepare_material_change(request,self.root)
        request['item']={'id':'pediatrics','label':'Pediatrics'}
        request['firstSubject']={'id':'../bad','label':'Invalid'}
        with self.assertRaises(SystemExit):
            prepare_material_change(request,self.root)
        request['firstSubject']={'id':'neonatology','label':'Neonatology'}
        request['approved']=True
        with self.assertRaises(SystemExit):
            prepare_material_change(request,self.root)

    def test_reject_chapter_to_wrong_subject_and_specialty_with_subject(self):
        wrong=self.draft('specialty','Nephrology','nephrology');wrong['subject']='urology'
        with self.assertRaises(SystemExit):prepare_change(wrong,self.root)

if __name__=='__main__': unittest.main()
