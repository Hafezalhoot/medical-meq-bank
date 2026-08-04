#!/usr/bin/env python3
"""Validate all embedded AVIF lecture question images and their source metadata."""
from __future__ import annotations
from pathlib import Path
import base64,binascii,hashlib,json
ROOT=Path(__file__).resolve().parents[1]
TARGET_LECTURES={
 'urology-bladder-cancer':8,
 'urology-urolithiasis':10,
 'urology-renal-tumors':6,
}
def fail(message):raise SystemExit('LECTURE IMAGE VALIDATION FAILED: '+message)
def load_json(path):
 if not path.is_file() or path.stat().st_size==0:fail(f'missing or empty file: {path.relative_to(ROOT)}')
 try:return json.loads(path.read_text(encoding='utf-8'))
 except (UnicodeDecodeError,json.JSONDecodeError) as e:fail(f'invalid JSON in {path.relative_to(ROOT)}: {e}')
def decode_avif(source,label):
 prefix='data:image/avif;base64,'
 if not isinstance(source,str) or not source:fail(f'{label} has no AVIF source')
 if source.startswith(prefix):
  try:raw=base64.b64decode(source[len(prefix):],validate=True)
  except (binascii.Error,ValueError) as e:fail(f'{label} contains invalid base64: {e}')
 elif source.startswith(('./assets/','assets/')):
  relative=source[2:] if source.startswith('./') else source
  path=(ROOT/relative).resolve()
  if not path.is_relative_to(ROOT.resolve()) or not path.is_file():fail(f'{label} asset is missing or unsafe: {relative}')
  raw=path.read_bytes()
 else:fail(f'{label} uses an unsupported AVIF source')
 if len(raw)<16 or raw[4:8]!=b'ftyp' or not (b'avif' in raw[8:32] or b'avis' in raw[8:32]):fail(f'{label} is not a valid AVIF payload')
 return raw
def main():
 catalog=load_json(ROOT/'lectures/catalog.json')
 if not isinstance(catalog,dict) or not isinstance(catalog.get('lectures'),list):fail('invalid lecture catalog')
 seen=set();total_bytes=0;seen_lectures=set()
 for entry in catalog['lectures']:
  if not isinstance(entry,dict) or entry.get('id') not in TARGET_LECTURES:continue
  lecture_id=entry['id'];seen_lectures.add(lecture_id);lecture=load_json(ROOT/'lectures'/str(entry.get('file')))
  questions=lecture.get('imageQuestions') if isinstance(lecture,dict) else None
  if not isinstance(questions,list):fail(f'invalid imageQuestions for {lecture_id}')
  if len(questions)!=TARGET_LECTURES[lecture_id]:fail(f'{lecture_id} has {len(questions)} images; expected {TARGET_LECTURES[lecture_id]}')
  for item in questions:
   if not isinstance(item,dict) or not isinstance(item.get('id'),str):fail(f'invalid image question in {lecture_id}')
   qid=item['id']
   if qid in seen:fail(f'duplicate image question id: {qid}')
   raw=decode_avif(item.get('image'),f'{lecture_id} {qid}');digest=hashlib.sha256(raw).hexdigest()
   if item.get('imageBytes')!=len(raw):fail(f'imageBytes mismatch for {qid}')
   if item.get('imageSha256')!=digest:fail(f'imageSha256 mismatch for {qid}')
   if item.get('page') in (None,''):fail(f'missing source page for {qid}')
   if not isinstance(item.get('prompt'),str) or not item['prompt'].strip():fail(f'missing visual prompt for {qid}')
   seen.add(qid);total_bytes+=len(raw)
 missing=set(TARGET_LECTURES)-seen_lectures
 if missing:fail('missing target lectures: '+', '.join(sorted(missing)))
 expected=sum(TARGET_LECTURES.values())
 if len(seen)!=expected:fail(f'expected {expected} embedded images, found {len(seen)}')
 print(f'Validated {expected} AVIF lecture images ({total_bytes} decoded bytes)')
if __name__=='__main__':main()
