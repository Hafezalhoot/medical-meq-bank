#!/usr/bin/env python3
"""Validate generated runtime ordering and extension safeguards."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "dist" / "index.html"
OFFLINE = ROOT / "dist" / "offline" / "Medical_MEQ_Review_Bank_Offline.html"


def fail(message: str) -> None:
    raise SystemExit(f"RUNTIME EXTENSION VALIDATION FAILED: {message}")


def read(path: Path) -> str:
    if not path.is_file() or path.stat().st_size == 0:
        fail(f"missing or empty file: {path.relative_to(ROOT)}")
    return path.read_text(encoding="utf-8")


def require_markers(source: str, markers: tuple[str, ...], label: str) -> None:
    for marker in markers:
        if marker not in source:
            fail(f"{label} is missing marker: {marker}")


def main() -> None:
    responsive = read(ROOT / "responsive-sidebars.js")
    search = read(ROOT / "search-optimization.js")
    loader = read(ROOT / "src" / "lecture-loader.js")
    html = read(HTML)
    offline = read(OFFLINE)

    require_markers(
        responsive,
        (
            "originalGet",
            "originalSet",
            "compactViewport",
            "hiddenFor",
            "storage.get = function",
            "window.setTimeout",
            "aria-pressed",
        ),
        "responsive sidebar source",
    )
    require_markers(
        search,
        (
            "FILTER_DELAY_MS = 300",
            "stopImmediatePropagation",
            "compositionstart",
            "compositionend",
            "meq:search-applied",
            "dataset.optimizedSearch",
            "dataset.filterDelay",
        ),
        "search optimization source",
    )
    require_markers(
        loader,
        (
            "loadCatalog",
            "loadSubject",
            "MEQLectureLoader",
            "meq:lectures-loaded",
            "loadedLectureIds",
            "normalizeLecture",
        ),
        "lecture loader source",
    )

    external_markers = (
        '<script src="./app.js"></script>',
        '<script src="./lecture-loader.js"></script>',
        '<script src="./pwa-client.js"></script>',
    )
    external_positions = []
    for marker in external_markers:
        if html.count(marker) != 1:
            fail(f"generated HTML must contain exactly one {marker}")
        external_positions.append(html.index(marker))
    if external_positions != sorted(external_positions):
        fail("app, lecture loader and PWA client are not loaded in the required order")

    ordered_ids = (
        "responsive-sidebar-extension",
        "review-filter-extension",
        "mobile-filter-extension",
        "search-optimization-extension",
        "print-manager-extension",
        "back-to-top-extension",
    )
    positions = []
    for element_id in ordered_ids:
        marker = f'id="{element_id}"'
        if html.count(marker) != 1:
            fail(f"generated HTML must contain exactly one {marker}")
        positions.append(html.index(marker))
    if positions != sorted(positions):
        fail("runtime extensions are not generated in the required order")
    if external_positions[-1] >= positions[0]:
        fail("runtime extensions execute before the core application scripts finish loading")

    review_position = html.index('id="review-filter-extension"')
    responsive_position = html.index('id="responsive-sidebar-extension"')
    if responsive_position >= review_position:
        fail("responsive sidebar safeguard must run before review-filter bootstrap")

    mobile_position = html.index('id="mobile-filter-extension"')
    search_position = html.index('id="search-optimization-extension"')
    if search_position <= mobile_position:
        fail("search optimizer must run after filter wrappers are installed")

    if 'id="lecture-extensions"' in html or "const incomingLectures" in html:
        fail("online HTML still embeds the full lecture bank")
    if offline.count('id="lecture-extensions"') != 1 or "const incomingLectures" not in offline:
        fail("standalone offline HTML does not contain the complete lecture bank")

    print("Validated lazy loader and runtime extension ordering")


if __name__ == "__main__":
    main()