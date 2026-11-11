import copy
import hashlib
import json
import unittest
from pathlib import Path
from scripts.validate_navigation_maps import validate_map, validate_repository

ROOT = Path(__file__).resolve().parent.parent


class NavigationMapTests(unittest.TestCase):
    def test_maps_cover_all_published_lectures(self):
        self.assertEqual(validate_repository(ROOT), 12)

    def test_mismatched_source_fingerprint_is_rejected(self):
        lecture_id = 'internal-medicine-ii-dermatology-introduction'
        source = ROOT / 'lectures/data' / f'{lecture_id}.json'
        original = json.loads(source.read_text())
        mapping = json.loads((ROOT / 'lectures/navigation' / f'{lecture_id}.json').read_text())
        tampered = copy.deepcopy(mapping)
        tampered['sourceSha256'] = '0' * 64
        with self.assertRaisesRegex(ValueError, 'fingerprint'):
            validate_map(tampered, original, hashlib.sha256(source.read_bytes()).hexdigest())

    def test_duplicate_section_owner_is_rejected(self):
        lecture_id = 'internal-medicine-ii-dermatology-introduction'
        source = ROOT / 'lectures/data' / f'{lecture_id}.json'
        original = json.loads(source.read_text())
        mapping = json.loads((ROOT / 'lectures/navigation' / f'{lecture_id}.json').read_text())
        tampered = copy.deepcopy(mapping)
        tampered['sections'][1] = copy.deepcopy(tampered['sections'][0])
        with self.assertRaisesRegex(ValueError, 'duplicate'):
            validate_map(tampered, original, hashlib.sha256(source.read_bytes()).hexdigest())

    def test_unmapped_sections_stay_explicit(self):
        lecture_id = 'internal-medicine-ii-dermatology-introduction'
        mapping = json.loads((ROOT / 'lectures/navigation' / f'{lecture_id}.json').read_text())
        self.assertEqual(len(mapping['sections']), 11)
        self.assertEqual(mapping['sections'][1]['topicId'], 'general')


if __name__ == '__main__':
    unittest.main()
