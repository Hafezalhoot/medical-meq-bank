#!/usr/bin/env python3
"""Create a PRIVATE, page-by-page inventory of the learner's original PDF.

No OCR, medical answer generation, uploads, public content writes or approvals.
Requires the repository's existing optional private-authoring dependency:
  python3 -m pip install -r tools/requirements-original-figures.txt
"""
from __future__ import annotations

from argparse import ArgumentParser
from hashlib import sha256
from pathlib import Path
import json
import os
import re
import shutil
import tempfile

ROOT = Path(__file__).resolve().parents[1]
MAX_PDF_BYTES = 150 * 1024 * 1024
MAX_PAGES = 500
MAX_VISUAL_PAGES = 120


class SourceInventoryError(ValueError):
    """A source-only intake cannot safely produce a trusted private inventory."""


def fingerprint(path: Path) -> str:
    digest = sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def check_pdf(path: Path) -> Path:
    if path.suffix.lower() != '.pdf':
        raise SourceInventoryError('Original source must have a .pdf PDF filename')
    if not path.is_file():
        raise SourceInventoryError('Original source PDF file does not exist')
    size = path.stat().st_size
    if not 100 <= size <= MAX_PDF_BYTES:
        raise SourceInventoryError('PDF source must be between 100 bytes and 150 MiB')
    with path.open('rb') as stream:
        if stream.read(5) != b'%PDF-':
            raise SourceInventoryError('Original file has no valid PDF header')
    return path


def load_fitz():
    try:
        import fitz
    except ImportError as error:
        raise SourceInventoryError(
            'Install optional local source-intake dependency: '
            'python3 -m pip install -r tools/requirements-original-figures.txt'
        ) from error
    return fitz


def inventory_pdf(pdf: Path) -> dict:
    """Inspect each page; native text and embedded image hashes are NOT clinical review."""
    pdf = check_pdf(Path(pdf))
    fitz = load_fitz()
    try:
        document = fitz.open(pdf)
    except Exception as error:
        raise SourceInventoryError('Cannot open this PDF; it may be damaged or unsupported') from error
    try:
        if document.needs_pass:
            raise SourceInventoryError('Password-protected PDFs need an unlocked original local copy')
        if not 1 <= document.page_count <= MAX_PAGES:
            raise SourceInventoryError('PDF must have between 1 and 500 pages')
        pages = []
        for index, page in enumerate(document):
            native_text = page.get_text('text', sort=True) or ''
            native_text = native_text.encode('utf-8', 'replace').decode('utf-8')
            embedded = []
            seen = set()
            failed_images = 0
            for image in page.get_images(full=True):
                xref = image[0]
                if xref in seen:
                    continue
                seen.add(xref)
                try:
                    data = document.extract_image(xref)
                    if not isinstance(data, dict) or not isinstance(data.get('image'), bytes):
                        raise ValueError('not an extractable embedded image')
                    raw = data['image']
                    ext = str(data.get('ext') or '').lower()
                    if not re.fullmatch(r'[a-z0-9]{1,7}', ext):
                        raise ValueError('unsafe extracted image extension')
                    embedded.append({
                        'xref': int(xref), 'width': int(image[2]),
                        'height': int(image[3]), 'extension': ext,
                        'bytes': len(raw), 'sha256': sha256(raw).hexdigest(),
                    })
                except Exception:
                    failed_images += 1
            drawings = len(page.get_drawings())
            pages.append({
                'page': index + 1,
                'widthPt': round(page.rect.width, 1),
                'heightPt': round(page.rect.height, 1),
                'nativeText': native_text,
                'nativeTextCharacters': len(native_text),
                'embeddedImages': embedded,
                'unreadableImageObjects': failed_images,
                'vectorDrawingPaths': drawings,
                'reviewState': 'needs-visual-review' if (not native_text.strip() or embedded or drawings or failed_images)
                               else 'needs-source-review',
                'reviewRequired': True,
            })
        return {
            'format': 'medical-library-original-pdf-inventory',
            'version': 1,
            'status': 'needs-source-review',
            'approved': False,
            'sourceFilename': pdf.name,
            'sourceBytes': pdf.stat().st_size,
            'sourceSha256': fingerprint(pdf),
            'pageCount': len(pages),
            'scope': 'native-text-and-embedded-images-only; no OCR or clinical verification',
            'pages': pages,
        }
    finally:
        document.close()


def load_matching_draft(path: Path, pdf_name: str) -> tuple[dict, bytes]:
    try:
        raw = path.read_bytes()
        draft = json.loads(raw.decode('utf-8'))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise SourceInventoryError('Cannot read the private reviewed lecture draft JSON') from error
    if (not isinstance(draft, dict)
            or not isinstance(draft.get('id'), str)
            or not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', draft['id'])
            or not isinstance(draft.get('sourceNote'), str)
            or not draft['sourceNote'].startswith(f'PDF source: {pdf_name};')):
        raise SourceInventoryError('Draft references a different source PDF or invalid lecture identity')
    for key in ('cases','coreShorts','imageQuestions','detailedShorts','rapid'):
        if not isinstance(draft.get(key), list):
            raise SourceInventoryError(f'Private draft has no valid {key} list')
    return draft, raw



def load_matching_intake(path: Path, pdf_name: str) -> tuple[dict, bytes, bytes]:
    """Reuse the reviewed wizard importer; never trust a source filename alone."""
    try:
        if path.stat().st_size > 128 * 1024:
            raise SourceInventoryError('Manage Library intake exceeds 128 KB')
        raw = path.read_bytes()
        document = json.loads(raw.decode('utf-8'))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise SourceInventoryError('Cannot read valid private Manage Library intake JSON') from error
    if (not isinstance(document, dict)
            or not isinstance(document.get('lecture'), dict)
            or document['lecture'].get('source') != pdf_name):
        raise SourceInventoryError('Manage Library intake references a different source PDF filename')
    from import_library_draft import prepare_intake
    try:
        draft = prepare_intake(document)
    except SystemExit as error:
        raise SourceInventoryError(f'Unreviewed or unsafe Manage Library intake: {error}') from error
    encoded = (json.dumps(draft, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
    return draft, encoded, raw


def source_topic_map_markdown(draft: dict) -> str:
    """Never infer topic PDF pages from textual similarity: leave links pending."""
    lines = [
        '# Topic-to-source page review — PRIVATE', '',
        '**NEEDS SOURCE REVIEW. Page links are NOT automatically guessed.**', '',
        '| Topic ID | Original lecture topic | PDF page(s) to verify | Source figures/tables | Reviewed |',
        '| --- | --- | --- | --- | --- |',
    ]
    for topic in draft.get('subtopics', []):
        label = ' '.join(str(topic.get('label', '')).split()).replace('|', r'\|')
        identifier = str(topic.get('id', '')).replace('|', r'\|')
        lines.append(f'| {identifier} | {label} | Not assigned | Not checked | [ ] |')
    lines += ['', 'Each topic must be manually linked to its actual source PDF pages.',
              'A text match never proves that printed figures, legends or tables are covered.',
              'Never publish MCQs or explanations before editorial source review.', '']
    return '\n'.join(lines)

def check_private_output(destination: Path) -> Path:
    dest = Path(destination).resolve()
    if dest.exists():
        raise SourceInventoryError(f'Private inventory destination already exists: {dest}')
    root = ROOT.resolve()
    if dest.is_relative_to(root) and not dest.is_relative_to(root / 'tmp'):
        raise SourceInventoryError('Within repository, private output must be inside private tmp/ only')
    return dest


def source_index_markdown(data: dict) -> str:
    lines = [
        '# Original PDF source inventory — PRIVATE', '',
        '**NEEDS SOURCE REVIEW. This is NOT a reviewed medical lecture or publication permission.**', '',
        f"- Original filename: {data['sourceFilename']}",
        f"- PDF SHA-256: {data['sourceSha256']}",
        f"- Independently measured page count: {data['pageCount']}",
        '- Native PDF text may omit every word printed inside a photograph, diagram, graph, table or scan.',
        '- Review the original page visually, including figures, legends, handwritten annotations and layouts.',
        '- Do not generate or infer medical answers from missing text; do not upload this inventory to the public repository.',
        '',
        '| Page | Native text characters | Embedded images | Vector paths | Reviewer action |',
        '| ---: | ---: | ---: | ---: | --- |',
    ]
    for page in data['pages']:
        lines.append(f"| {page['page']} | {page['nativeTextCharacters']} | {len(page['embeddedImages'])} | "
                     f"{page['vectorDrawingPaths']} | [ ] Inspect source + figures |")
    lines += ['', '## Completion requirements', '',
              '- [ ] Visually inspect every page against the original PDF, not just extracted text.',
              '- [ ] Check all tables, printed labels, images, and diagrams for exam-relevant information.',
              '- [ ] Map every explanation, source MCQ and original figure to its printed source page.',
              '- [ ] Verify source answer indices and rationale manually; do not auto-publish.',
              '- [ ] Confirm original figure reuse rights and explicit medical/editorial approval.',
              '']
    return '\n'.join(lines)


def create_private_bundle(
    pdf: Path, destination: Path,
    *, draft_path: Path | None = None,
    intake_path: Path | None = None,
    render_pages: bool = False,
    extract_images: bool = False,
    dpi: int = 120,
) -> dict:
    """Write an all-or-nothing private package with optional source-only visuals."""
    if draft_path is not None and intake_path is not None:
        raise SourceInventoryError('Choose only one of --draft or --intake')
    pdf = Path(pdf)
    data = inventory_pdf(pdf)
    dest = check_private_output(Path(destination))
    if not 72 <= dpi <= 180:
        raise SourceInventoryError('Preview DPI must be between 72 and 180')
    if render_pages and data['pageCount'] > MAX_VISUAL_PAGES:
        raise SourceInventoryError('Preview rendering limited to 120 pages; inspect large PDFs in batches')
    draft = raw_draft = raw_intake = None
    if draft_path is not None:
        draft, raw_draft = load_matching_draft(Path(draft_path), pdf.name)
    if intake_path is not None:
        draft, raw_draft, raw_intake = load_matching_intake(Path(intake_path), pdf.name)
        data['intakeSha256'] = sha256(raw_intake).hexdigest()
    dest.parent.mkdir(parents=True, exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix='.medical-source-', dir=dest.parent))
    try:
        (stage/'source-inventory.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        (stage/'source-index.md').write_text(source_index_markdown(data),encoding='utf-8')
        text_dir = stage/'source-pages'
        text_dir.mkdir()
        for page in data['pages']:
            (text_dir/f"page-{page['page']:04d}.txt").write_text(page['nativeText'],encoding='utf-8')
        if draft is not None:
            from lecture_review_report import build_report
            (stage/'lecture-draft.json').write_bytes(raw_draft)
            (stage/'source-topic-map.md').write_text(source_topic_map_markdown(draft),encoding='utf-8')
            if raw_intake is not None:
                (stage/'intake-request.json').write_bytes(raw_intake)
            report=build_report(draft,pdf.name,data['sourceSha256'],data['pageCount'],sha256(raw_draft).hexdigest())
            (stage/'review.md').write_text(report,encoding='utf-8')
        if render_pages or extract_images:
            fitz=load_fitz()
            with fitz.open(pdf) as document:
                if render_pages:
                    thumbs=stage/'page-previews'
                    thumbs.mkdir()
                    for index,page in enumerate(document):
                        pixmap=page.get_pixmap(matrix=fitz.Matrix(dpi/72,dpi/72),alpha=False)
                        pixmap.save(thumbs/f'page-{index+1:04d}.png')
                if extract_images:
                    images=stage/'original-images'
                    images.mkdir()
                    seen=set()
                    for page in data['pages']:
                        for record in page['embeddedImages']:
                            xref=record['xref']
                            if xref in seen:continue
                            seen.add(xref)
                            payload=document.extract_image(xref)['image']
                            if sha256(payload).hexdigest()!=record['sha256']:
                                raise SourceInventoryError('Source image changed during private extraction')
                            (images/f"xref-{xref}-{record['sha256'][:12]}.{record['extension']}").write_bytes(payload)
        (stage/'START_HERE.txt').write_text(
            'PRIVATE ORIGINAL PDF SOURCE INVENTORY\n'
            'Native text is a draft transcription, NOT full source coverage.\n'
            'Start with source-index.md and inspect every original page.\n'
            'Review image text, diagrams, legends, tables and source page references.\n'
            'Source original is NOT included; keep the original PDF available privately.\n'
            'All review checkboxes remain unchecked. No facts, answers or exam keys were generated.\n'
            'Never commit this output directory or original lecture PDFs to a public repository.\n',
            encoding='utf-8',
        )
        os.chmod(stage,0o700)
        if dest.exists():
            raise SourceInventoryError(f'Private inventory destination already exists: {dest}')
        stage.rename(dest)
    finally:
        if stage.exists():shutil.rmtree(stage)
    return data


def main() -> None:
    parser=ArgumentParser(description=__doc__)
    parser.add_argument('pdf',type=Path,help='Original private source PDF file')
    draft_options=parser.add_mutually_exclusive_group()
    draft_options.add_argument('--draft',type=Path,help='Optional unpublished draft JSON from import_library_draft.py')
    draft_options.add_argument('--intake',type=Path,help='Wizard .intake.json with exact matching original PDF')
    parser.add_argument('--output-dir',type=Path,help='Private output directory; never overwrite')
    parser.add_argument('--render-pages',action='store_true',help='Privately render source page thumbnails')
    parser.add_argument('--extract-images',action='store_true',help='Privately extract exact PDF embedded-image bytes')
    parser.add_argument('--dpi',type=int,default=120,help='Preview resolution, 72..180 (default 120)')
    args=parser.parse_args()
    try:
        checked=check_pdf(args.pdf)
        directory=args.output_dir or (ROOT/'tmp'/'pdf-source-inventory'/checked.stem)
        info=create_private_bundle(args.pdf,directory,draft_path=args.draft,intake_path=args.intake,
                                   render_pages=args.render_pages,extract_images=args.extract_images,dpi=args.dpi)
    except (SourceInventoryError,OSError) as error:
        parser.exit(2,f'PDF SOURCE INVENTORY FAILED: {error}\n')
    print(f"Created private source-review bundle: {Path(directory).resolve()}")
    print(f"Exact original PDF: {info['pageCount']} pages, SHA-256 {info['sourceSha256']}")
    print('Next: review every page and source figure; do NOT publish until medical editorial sign-off.')


if __name__=='__main__':
    main()
