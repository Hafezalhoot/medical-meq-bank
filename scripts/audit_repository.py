#!/usr/bin/env python3
"""Audit generated Medical MEQ Bank files for broken references and CSP drift."""

from __future__ import annotations

from collections import Counter
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
OFFLINE = DIST / "offline" / "Medical_MEQ_Review_Bank_Offline.html"
INVALID_URL_VALUES = {"undefined", "null", "[object object]", "nan"}
ONLINE_EXTENSION_ASSETS = {
    "review-filter.css",
    "review-filter.js",
    "responsive-sidebars.js",
    "mobile-filters.css",
    "mobile-filters.js",
    "search-optimization.js",
    "print-manager.css",
    "print-manager.js",
    "back-to-top.css",
    "back-to-top.js",
}


def fail(message: str) -> None:
    raise SystemExit(f"REPOSITORY AUDIT FAILED: {message}")


def require_file(path: Path) -> None:
    if not path.is_file() or path.stat().st_size == 0:
        fail(f"missing or empty generated file: {path.relative_to(ROOT)}")


class HtmlAuditParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.ids: list[str] = []
        self.references: list[tuple[str, str, str]] = []
        self.id_references: list[tuple[str, str, str]] = []

    def _record(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        for name, raw_value in attrs:
            value = raw_value or ""
            if name == "id" and value:
                self.ids.append(value)
            if name in {"src", "href", "poster"}:
                self.references.append((tag, name, value))
            if name in {"for", "aria-labelledby", "aria-describedby"}:
                for token in value.split():
                    if token:
                        self.id_references.append((tag, name, token))

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self._record(tag, attrs)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self._record(tag, attrs)


def parse_html(path: Path) -> tuple[HtmlAuditParser, str]:
    require_file(path)
    source = path.read_text(encoding="utf-8")
    parser = HtmlAuditParser()
    parser.feed(source)
    parser.close()
    return parser, source


def is_external_or_embedded(value: str) -> bool:
    lowered = value.strip().lower()
    return (
        not lowered
        or lowered.startswith("#")
        or lowered.startswith("//")
        or lowered.startswith(("data:", "blob:", "http:", "https:", "mailto:", "tel:"))
    )


def resolve_local_reference(page: Path, value: str) -> Path | None:
    stripped = value.strip()
    if is_external_or_embedded(stripped):
        return None
    if stripped.lower() in INVALID_URL_VALUES:
        fail(f"{page.relative_to(ROOT)} contains invalid resource URL {stripped!r}")

    parsed = urlsplit(stripped)
    if parsed.scheme or parsed.netloc:
        return None
    decoded_path = unquote(parsed.path)
    if not decoded_path:
        return None
    target = DIST / decoded_path.lstrip("/") if decoded_path.startswith("/") else page.parent / decoded_path
    target = target.resolve()
    try:
        target.relative_to(DIST.resolve())
    except ValueError:
        fail(f"{page.relative_to(ROOT)} reference escapes dist: {value}")
    return target


def audit_online_script_policy(path: Path, source: str) -> None:
    inline_scripts = re.findall(r"<script(?![^>]*\bsrc=)[^>]*>", source, flags=re.I)
    inline_styles = re.findall(r"<style\b[^>]*>", source, flags=re.I)
    inline_handlers = re.findall(r"\son[a-z]+\s*=", source, flags=re.I)
    if inline_scripts:
        fail(f"{path.relative_to(ROOT)} contains inline executable scripts")
    if inline_styles:
        fail(f"{path.relative_to(ROOT)} contains inline style blocks")
    if inline_handlers:
        fail(f"{path.relative_to(ROOT)} contains inline event handlers")


def audit_html(path: Path, *, standalone: bool = False) -> tuple[int, int]:
    parser, source = parse_html(path)
    duplicate_ids = sorted(value for value, count in Counter(parser.ids).items() if count > 1)
    if duplicate_ids:
        fail(f"{path.relative_to(ROOT)} has duplicate IDs: {', '.join(duplicate_ids)}")

    if path == DIST / "index.html":
        audit_online_script_policy(path, source)

    known_ids = set(parser.ids)
    missing_id_refs = sorted({
        f"{tag}[{attribute}={target}]"
        for tag, attribute, target in parser.id_references
        if target not in known_ids
    })
    if missing_id_refs:
        fail(
            f"{path.relative_to(ROOT)} references missing element IDs: "
            + ", ".join(missing_id_refs)
        )

    local_count = 0
    for tag, attribute, value in parser.references:
        target = resolve_local_reference(path, value)
        if target is None:
            continue
        local_count += 1
        if standalone:
            fail(
                f"standalone offline HTML still depends on local resource "
                f"{tag}[{attribute}={value!r}]"
            )
        if not target.exists():
            fail(
                f"broken internal reference in {path.relative_to(ROOT)}: "
                f"{tag}[{attribute}={value!r}]"
            )

    return len(parser.ids), local_count


def audit_manifest() -> int:
    path = DIST / "manifest.webmanifest"
    require_file(path)
    try:
        manifest = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        fail(f"invalid generated manifest: {error}")
    icons = manifest.get("icons") if isinstance(manifest, dict) else None
    if not isinstance(icons, list) or not icons:
        fail("generated manifest has no icons")
    for icon in icons:
        source = icon.get("src") if isinstance(icon, dict) else None
        if not isinstance(source, str) or not source.strip():
            fail("generated manifest contains an invalid icon source")
        target = resolve_local_reference(path, source)
        if target is None or not target.is_file():
            fail(f"generated manifest icon does not exist: {source}")
    return len(icons)


def audit_headers() -> None:
    path = DIST / "_headers"
    require_file(path)
    headers = path.read_text(encoding="utf-8")
    if "script-src 'self' 'unsafe-inline'" in headers:
        fail("deployed CSP still allows unsafe inline JavaScript")
    for marker in ("script-src 'self';", "script-src-attr 'none';", "object-src 'none';"):
        if marker not in headers:
            fail(f"deployed CSP is missing {marker}")


def audit_service_worker() -> int:
    path = DIST / "service-worker.js"
    require_file(path)
    worker = path.read_text(encoding="utf-8")
    if "/*__LECTURE_ASSETS__*/ []" in worker:
        fail("generated service worker still contains the lecture placeholder")

    resources = sorted(set(re.findall(r"['\"](\./[^'\"]+)['\"]", worker)))
    resource_set = set(resources)
    missing_extensions = sorted(
        asset for asset in ONLINE_EXTENSION_ASSETS if f"./{asset}" not in resource_set
    )
    if missing_extensions:
        fail("service worker does not cache online extensions: " + ", ".join(missing_extensions))

    checked = 0
    for resource in resources:
        if any(character in resource for character in "${}*"):
            continue
        target = resolve_local_reference(path, resource)
        if target is not None:
            checked += 1
            if not target.exists():
                fail(f"service-worker resource does not exist: {resource}")
    if checked < 20:
        fail("service-worker audit found too few concrete resources")
    return checked


def main() -> None:
    index_ids, index_refs = audit_html(DIST / "index.html")
    page_404_ids, page_404_refs = audit_html(DIST / "404.html")
    offline_ids, _ = audit_html(OFFLINE, standalone=True)
    icon_count = audit_manifest()
    audit_headers()
    worker_resources = audit_service_worker()

    print(
        "Repository audit passed: "
        f"{index_ids + page_404_ids + offline_ids} unique HTML IDs, "
        f"{index_refs + page_404_refs} valid local references, "
        f"{icon_count} manifest icons, "
        f"{worker_resources} service-worker resources, "
        "strict external online scripts, and a self-contained offline HTML file."
    )


if __name__ == "__main__":
    main()
