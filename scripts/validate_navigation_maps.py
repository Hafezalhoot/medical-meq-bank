#!/usr/bin/env python3
"""Validate source-neutral, fingerprint-bound lecture topic navigation maps."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def require(test: bool, reason: str) -> None:
    if not test:
        raise ValueError(reason)


def validate_map(mapping: dict, lecture: dict, fingerprint: str) -> None:
    require(mapping.get('schemaVersion') == 1, 'unsupported navigation schema')
    require(mapping.get('lectureId') == lecture.get('id'), 'wrong lecture identity')
    require(mapping.get('sourceSha256') == fingerprint, 'stale navigation fingerprint')
    sections = mapping.get('sections')
    explanation = (lecture.get('studyGuide') or {}).get('explanation') or []
    require(isinstance(sections, list) and len(sections) == len(explanation), 'missing explanation sections')
    topics = {topic['id'] for topic in lecture.get('subtopics', [])}
    seen_ids, seen_indices = set(), set()
    for section in sections:
        require(isinstance(section, dict), 'invalid section object')
        sid, index = section.get('id'), section.get('sourceIndex')
        require(isinstance(sid, str) and sid.startswith('e-') and sid[2:].isdigit(), 'invalid stable section id')
        require(isinstance(index, int) and not isinstance(index, bool) and 0 <= index < len(explanation), 'bad explanation index')
        require(sid not in seen_ids and index not in seen_indices, 'duplicate section id/owner')
        seen_ids.add(sid); seen_indices.add(index)
        require(section.get('heading') == explanation[index].get('heading'), 'source heading drift')
        primary = section.get('topicId')
        require(primary == 'general' or primary in topics, 'unrecognised primary topic')
        related = section.get('relatedTopicIds') or []
        require(isinstance(related, list) and len(related) == len(set(related)) and
                all(item in topics and item != primary for item in related),
                'invalid secondary topic references')
    require(seen_indices == set(range(len(explanation))), 'orphaned source section')


def validate_repository(root: Path = ROOT) -> int:
    catalog = json.loads((root / 'lectures/catalog.json').read_text())
    registry = catalog['lectures']
    base = root / 'lectures/navigation'
    expected = {item['id'] for item in registry}
    observed = {p.stem for p in base.glob('*.json')}
    require(expected == observed, 'navigation map registry mismatch')
    for entry in registry:
        source = root / 'lectures' / entry['file']
        original = json.loads(source.read_text())
        mapping = json.loads((base / (entry['id'] + '.json')).read_text())
        validate_map(mapping, original, hashlib.sha256(source.read_bytes()).hexdigest())
    return len(registry)


if __name__ == '__main__':
    print('Validated navigation maps for', validate_repository(), 'lectures')
