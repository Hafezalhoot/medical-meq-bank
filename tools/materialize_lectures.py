#!/usr/bin/env python3
"""Materialize generated lecture JSON from a data-driven source manifest."""

from __future__ import annotations

from pathlib import Path
import base64
import binascii
import gzip
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
LECTURES = ROOT / "lectures"
MANIFEST = LECTURES / "materialization.json"
AVIF_PREFIX = "data:image/avif;base64,"


def fail(message: str) -> None:
    raise SystemExit(f"LECTURE MATERIALIZATION FAILED: {message}")


def read_json(path: Path) -> object:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        try:
            label = path.relative_to(ROOT)
        except ValueError:
            label = path
        fail(f"cannot read {label}: {error}")


def safe_path(base: Path, relative: str) -> Path:
    if not isinstance(relative, str) or not relative:
        fail("materialization manifest contains an empty path")
    path = (base / relative).resolve()
    if not path.is_relative_to(ROOT.resolve()):
        fail(f"materialization path escapes repository: {relative}")
    return path


def normalized_ascii(path: Path) -> str:
    try:
        return "".join(path.read_text(encoding="ascii").split())
    except (OSError, UnicodeDecodeError) as error:
        fail(f"cannot read transport payload {path.relative_to(ROOT)}: {error}")


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("ascii")).hexdigest()


def decode_avif(source: object, *, label: str) -> bytes:
    if not isinstance(source, str) or not source.startswith(AVIF_PREFIX):
        fail(f"{label} does not contain an embedded AVIF data URI")
    try:
        raw = base64.b64decode(source[len(AVIF_PREFIX):], validate=True)
    except (binascii.Error, ValueError) as error:
        fail(f"{label} contains invalid image base64: {error}")
    brands = {raw[index:index + 4] for index in range(8, min(len(raw), 32), 4)}
    if len(raw) < 16 or raw[4:8] != b"ftyp" or not ({b"avif", b"avis"} & brands):
        fail(f"{label} is not a valid AVIF payload")
    return raw


def repair_part(
    normalized: str,
    *,
    repair: object,
    expected_hash: str,
    label: str,
) -> str:
    current_hash = sha256_text(normalized)
    if current_hash == expected_hash:
        return normalized
    if not isinstance(repair, dict) or current_hash != repair.get("source_sha256"):
        fail(f"{label} checksum is {current_hash}; expected {expected_hash}")

    chunks = repair.get("replacement_chunks")
    if isinstance(chunks, list) and chunks:
        repaired_parts = []
        for chunk in chunks:
            if not isinstance(chunk, dict):
                fail(f"{label} has an invalid replacement chunk")
            path = safe_path(LECTURES, chunk.get("path"))
            value = normalized_ascii(path)
            if len(value) != chunk.get("length"):
                fail(f"{path.relative_to(ROOT)} has an unexpected length")
            digest = sha256_text(value)
            if digest != chunk.get("sha256"):
                fail(f"{path.relative_to(ROOT)} checksum is {digest}")
            repaired_parts.append(value)
        repaired = "".join(repaired_parts)
    else:
        insert_at = repair.get("insert_at")
        text = repair.get("text")
        if not isinstance(insert_at, int) or not isinstance(text, str):
            fail(f"{label} has an invalid deterministic repair")
        repaired = normalized[:insert_at] + text + normalized[insert_at:]

    repaired_hash = sha256_text(repaired)
    if repaired_hash != expected_hash:
        fail(f"{label} repair produced {repaired_hash}; expected {expected_hash}")
    return repaired


def validate_materialized_lecture(
    lecture: object,
    *,
    lecture_id: str,
    image_count: int | None = None,
) -> dict:
    if not isinstance(lecture, dict) or lecture.get("id") != lecture_id:
        fail(f"materialized lecture does not match id {lecture_id}")
    images = lecture.get("imageQuestions")
    if not isinstance(images, list):
        fail(f"{lecture_id} has no imageQuestions list")
    if image_count is not None and len(images) != image_count:
        fail(f"{lecture_id} has {len(images)} images; expected {image_count}")

    seen: set[str] = set()
    for item in images:
        if not isinstance(item, dict) or not isinstance(item.get("id"), str):
            fail(f"{lecture_id} contains an invalid image question")
        item_id = item["id"]
        if item_id in seen:
            fail(f"{lecture_id} contains duplicate image question {item_id}")
        seen.add(item_id)
        if isinstance(item.get("image"), str):
            raw = decode_avif(item["image"], label=f"{lecture_id}/{item_id}")
            if item.get("imageBytes") not in (None, len(raw)):
                fail(f"{lecture_id}/{item_id} imageBytes mismatch")
            digest = hashlib.sha256(raw).hexdigest()
            if item.get("imageSha256") not in (None, digest):
                fail(f"{lecture_id}/{item_id} imageSha256 mismatch")
    return lecture


def materialize_compressed(target: dict) -> None:
    output = safe_path(LECTURES, target.get("output"))
    lecture_id = target.get("lectureId")
    hashes = target.get("partSha256")
    if not isinstance(lecture_id, str) or not isinstance(hashes, list) or not hashes:
        fail("compressed-parts target is incomplete")

    payload_dir = LECTURES / "payloads-v2"
    filename = output.name
    expected_parts = [
        payload_dir / f"{filename}.gz.b64.part{index:02d}"
        for index in range(1, len(hashes) + 1)
    ]
    actual_parts = sorted(payload_dir.glob(f"{filename}.gz.b64.part*"))
    if actual_parts != expected_parts:
        names = ", ".join(path.name for path in actual_parts) or "none"
        fail(f"{lecture_id} payload parts are incomplete or unexpected: {names}")

    repairs = target.get("partRepairs")
    repairs = repairs if isinstance(repairs, dict) else {}
    normalized_parts = []
    for index, (path, expected_hash) in enumerate(zip(expected_parts, hashes), start=1):
        if not isinstance(expected_hash, str):
            fail(f"{lecture_id} has an invalid checksum at part {index}")
        normalized = normalized_ascii(path)
        normalized = repair_part(
            normalized,
            repair=repairs.get(str(index), repairs.get(index)),
            expected_hash=expected_hash,
            label=f"{lecture_id} part {index:02d}",
        )
        normalized_parts.append(normalized)

    encoded = "".join(normalized_parts)
    if len(encoded) % 4:
        fail(f"{lecture_id} base64 length is not divisible by four")
    try:
        compressed = base64.b64decode(encoded, validate=True)
        raw = gzip.decompress(compressed)
    except (binascii.Error, ValueError, OSError, EOFError) as error:
        fail(f"could not decode {lecture_id}: {error}")

    if len(raw) != target.get("rawBytes"):
        fail(f"{lecture_id} decoded byte count differs from manifest")
    digest = hashlib.sha256(raw).hexdigest()
    if digest != target.get("sha256"):
        fail(f"{lecture_id} decoded checksum is {digest}")

    try:
        lecture = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        fail(f"{lecture_id} is not valid UTF-8 JSON: {error}")
    validate_materialized_lecture(
        lecture,
        lecture_id=lecture_id,
        image_count=target.get("imageCount"),
    )

    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(output.suffix + ".tmp")
    temporary.write_bytes(raw)
    temporary.replace(output)
    print(f"Materialized {lecture_id} from verified compressed parts")


def materialize_template_assets(target: dict) -> None:
    lecture_id = target.get("lectureId")
    output = safe_path(LECTURES, target.get("output"))
    template_glob = target.get("templateGlob")
    asset_manifest_path = target.get("assetManifest")
    asset_field = target.get("imageAssetField", "imageAsset")
    if not all(isinstance(value, str) and value for value in (
        lecture_id, template_glob, asset_manifest_path, asset_field
    )):
        fail("template-assets target is incomplete")

    parts = sorted(LECTURES.glob(template_glob))
    if not parts:
        fail(f"{lecture_id} template parts are missing")
    try:
        lecture = json.loads("".join(path.read_text(encoding="utf-8") for path in parts))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        fail(f"cannot assemble {lecture_id} template: {error}")

    manifest_path = safe_path(ROOT, asset_manifest_path)
    asset_manifest = read_json(manifest_path)
    entries = asset_manifest.get("assets") if isinstance(asset_manifest, dict) else None
    if not isinstance(asset_manifest, dict) or asset_manifest.get("version") != 1 or not isinstance(entries, list):
        fail(f"{lecture_id} asset manifest is invalid")

    assets: dict[str, tuple[dict, bytes]] = {}
    for item in entries:
        if not isinstance(item, dict) or not isinstance(item.get("id"), str):
            fail(f"{lecture_id} asset manifest contains an invalid entry")
        asset_id = item["id"]
        if asset_id in assets:
            fail(f"{lecture_id} asset manifest duplicates {asset_id}")
        source = item.get("source")
        if not isinstance(source, str) or not source.endswith(".avif.b64"):
            fail(f"{lecture_id}/{asset_id} has an invalid source path")
        path = safe_path(manifest_path.parent, source)
        if path.parent != manifest_path.parent.resolve() or not path.is_file():
            fail(f"{lecture_id}/{asset_id} source is missing or unsafe")
        try:
            raw = base64.b64decode(path.read_text(encoding="ascii").strip(), validate=True)
        except (OSError, UnicodeDecodeError, binascii.Error, ValueError) as error:
            fail(f"{lecture_id}/{asset_id} base64 is invalid: {error}")
        digest = hashlib.sha256(raw).hexdigest()
        if len(raw) != item.get("bytes") or digest != item.get("sha256"):
            fail(f"{lecture_id}/{asset_id} asset checksum differs from manifest")
        if len(raw) < 16 or raw[4:8] != b"ftyp" or b"avif" not in raw[8:32]:
            fail(f"{lecture_id}/{asset_id} is not a valid AVIF payload")
        assets[asset_id] = (item, raw)

    images = lecture.get("imageQuestions")
    if not isinstance(images, list):
        fail(f"{lecture_id} template has no imageQuestions list")
    used: set[str] = set()
    for item in images:
        if not isinstance(item, dict) or not isinstance(item.get(asset_field), str):
            fail(f"{lecture_id} image question has no {asset_field}")
        asset_id = item.pop(asset_field)
        if asset_id not in assets:
            fail(f"{lecture_id} references unknown image asset {asset_id}")
        metadata, raw = assets[asset_id]
        item["image"] = AVIF_PREFIX + base64.b64encode(raw).decode("ascii")
        item["imageBytes"] = metadata["bytes"]
        item["imageSha256"] = metadata["sha256"]
        used.add(asset_id)

    unused = sorted(set(assets) - used)
    if unused:
        fail(f"{lecture_id} has unused image assets: {', '.join(unused)}")

    validate_materialized_lecture(lecture, lecture_id=lecture_id, image_count=len(assets))
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(lecture, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Materialized {lecture_id} from template + verified assets")


def main() -> None:
    manifest = read_json(MANIFEST)
    targets = manifest.get("targets") if isinstance(manifest, dict) else None
    if not isinstance(manifest, dict) or manifest.get("version") != 1 or not isinstance(targets, list) or not targets:
        fail("lectures/materialization.json must be version 1 with targets")

    seen_outputs: set[str] = set()
    seen_ids: set[str] = set()
    for target in targets:
        if not isinstance(target, dict):
            fail("materialization manifest contains a non-object target")
        kind = target.get("kind")
        output = target.get("output")
        lecture_id = target.get("lectureId")
        if not isinstance(output, str) or output in seen_outputs:
            fail(f"duplicate or invalid materialization output: {output}")
        if not isinstance(lecture_id, str) or lecture_id in seen_ids:
            fail(f"duplicate or invalid materialization lecture id: {lecture_id}")
        seen_outputs.add(output)
        seen_ids.add(lecture_id)

        if kind == "compressed-parts":
            materialize_compressed(target)
        elif kind == "template-assets":
            materialize_template_assets(target)
        else:
            fail(f"unsupported materialization kind for {lecture_id}: {kind}")


if __name__ == "__main__":
    main()
