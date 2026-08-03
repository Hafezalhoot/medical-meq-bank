#!/usr/bin/env python3
"""Validate source markers and generated ordering for runtime extensions."""

from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "dist" / "index.html"


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
    html = read(HTML)

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
            "FILTER_DELAY_MS = 160",
            "stopImmediatePropagation",
            "compositionstart",
            "compositionend",
            "meq:search-applied",
            "data-optimized-search",
        ),
        "search optimization source",
    )

    ordered_ids = (
        "lecture-extensions",
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

    review_position = html.index('id="review-filter-extension"')
    responsive_position = html.index('id="responsive-sidebar-extension"')
    if responsive_position >= review_position:
        fail("responsive sidebar safeguard must run before review-filter bootstrap")

    mobile_position = html.index('id="mobile-filter-extension"')
    search_position = html.index('id="search-optimization-extension"')
    if search_position <= mobile_position:
        fail("search optimizer must run after filter wrappers are installed")

    print("Validated runtime extension ordering and safeguards")


if __name__ == "__main__":
    main()
