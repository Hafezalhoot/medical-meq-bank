#!/usr/bin/env python3
"""Materialize Renal Tumors review JSON with checksummed AVIF lecture images."""

from __future__ import annotations

from pathlib import Path
import base64
import binascii
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE_DIR = ROOT / 'lectures' / 'templates' / 'renal-parts'
TEMPLATE_PATTERN = 'urology-renal-tumors.part*.jsonpart'
MANIFEST = ROOT / 'assets-source' / 'renal' / 'manifest.json'
OUTPUT = ROOT / 'lectures' / 'data' / 'urology-renal-tumors.json'
PREFIX = 'data:image/avif;base64,'


def fail(message: str) -> None:
    raise SystemExit(f'RENAL TUMORS MATERIALIZATION FAILED: {message}')


def load_json(path: Path) -> object:
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        fail(f'cannot read {path.relative_to(ROOT)}: {error}')


def main() -> None:
    parts = sorted(TEMPLATE_DIR.glob(TEMPLATE_PATTERN))
    if not parts:
        fail('lecture template parts are missing')
    try:
        lecture = json.loads(''.join(path.read_text(encoding='utf-8') for path in parts))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        fail(f'cannot assemble lecture template: {error}')
    manifest = load_json(MANIFEST)
    if not isinstance(lecture, dict) or lecture.get('id') != 'urology-renal-tumors':
        fail('lecture template has an unexpected id')
    if not isinstance(manifest, dict) or manifest.get('version') != 1 or not isinstance(manifest.get('assets'), list):
        fail('image manifest must be version 1')

    assets = {}
    for entry in manifest['assets']:
        if not isinstance(entry, dict) or not isinstance(entry.get('id'), str):
            fail('invalid image manifest entry')
        asset_id = entry['id']
        if asset_id in assets:
            fail(f'duplicate image asset id: {asset_id}')
        source = entry.get('source')
        if not isinstance(source, str) or not source.endswith('.avif.b64'):
            fail(f'invalid source path for {asset_id}')
        source_path = (MANIFEST.parent / source).resolve()
        if source_path.parent != MANIFEST.parent.resolve() or not source_path.is_file():
            fail(f'missing or unsafe source for {asset_id}')
        try:
            raw = base64.b64decode(source_path.read_text(encoding='ascii').strip(), validate=True)
        except (OSError, UnicodeDecodeError, binascii.Error, ValueError) as error:
            fail(f'invalid base64 for {asset_id}: {error}')
        digest = hashlib.sha256(raw).hexdigest()
        if len(raw) != entry.get('bytes'):
            fail(f'byte count mismatch for {asset_id}')
        if digest != entry.get('sha256'):
            fail(f'checksum mismatch for {asset_id}')
        if len(raw) < 16 or raw[4:8] != b'ftyp' or b'avif' not in raw[8:32]:
            fail(f'{asset_id} is not a valid AVIF payload')
        assets[asset_id] = (entry, raw)

    questions = lecture.get('imageQuestions')
    if not isinstance(questions, list):
        fail('lecture template has no imageQuestions list')
    used = set()
    for item in questions:
        if not isinstance(item, dict) or not isinstance(item.get('imageAsset'), str):
            fail('image question has no imageAsset id')
        asset_id = item.pop('imageAsset')
        if asset_id not in assets:
            fail(f'image question references unknown asset: {asset_id}')
        entry, raw = assets[asset_id]
        item['image'] = PREFIX + base64.b64encode(raw).decode('ascii')
        item['imageBytes'] = entry['bytes']
        item['imageSha256'] = entry['sha256']
        used.add(asset_id)

    unused = sorted(set(assets) - used)
    if unused:
        fail('unused image assets: ' + ', '.join(unused))

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(lecture, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Materialized Renal Tumors with {len(questions)} verified AVIF images')


if __name__ == '__main__':
    main()
