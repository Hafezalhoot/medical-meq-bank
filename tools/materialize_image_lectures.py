#!/usr/bin/env python3
from __future__ import annotations
from base64 import b64decode
from gzip import decompress
from hashlib import sha256
from json import loads
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAYLOAD_DIR = ROOT / 'lectures' / 'payloads'
TARGETS = {
    'urology-bladder-cancer.json': {
        'files': [
            'urology-bladder-cancer.json.gz.part01',
            'urology-bladder-cancer.json.gz.part02',
            'urology-bladder-cancer.json.gz.part03',
        ],
        'encoding': 'binary',
        'sha256': '9f3129600ef233a593b260c01745415fb70ade3d35891835616cd84343e52fa6',
        'count': 8,
    },
    'urology-urolithiasis.json': {
        'files': ['urology-urolithiasis.json.gz'],
        'encoding': 'base64',
        'sha256': 'd985e2459155bbbc55044eab8ce8ef27a9caef61c8aa6f0b2fe27b029712cf40',
        'count': 10,
    },
}

def main():
    for filename, cfg in TARGETS.items():
        packed = b''.join((PAYLOAD_DIR / name).read_bytes() for name in cfg['files'])
        if cfg['encoding'] == 'base64':
            packed = b64decode(packed, validate=True)
        raw = decompress(packed)
        digest = sha256(raw).hexdigest()
        if digest != cfg['sha256']:
            raise SystemExit(f'Checksum mismatch for {filename}: {digest}')
        lecture = loads(raw.decode('utf-8'))
        images = lecture.get('imageQuestions', [])
        if len(images) != cfg['count']:
            raise SystemExit(f'Unexpected image count for {filename}: {len(images)}')
        broken = [item.get('id','unknown') for item in images if not isinstance(item.get('image'), str) or not item['image'].startswith('data:image/')]
        if broken:
            raise SystemExit(f'Missing image payloads for {filename}: {broken}')
        target = ROOT / 'lectures' / 'data' / filename
        target.write_bytes(raw)
        print(f'Materialized {filename} with {len(images)} verified images')

if __name__ == '__main__':
    main()
