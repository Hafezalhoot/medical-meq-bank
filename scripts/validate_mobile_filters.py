#!/usr/bin/env python3
"""Validate mobile filter source and generated integration."""

from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DIST_INDEX = ROOT / "dist" / "index.html"


def fail(message: str) -> None:
    raise SystemExit(f"MOBILE FILTER VALIDATION FAILED: {message}")


def read(path: Path) -> str:
    if not path.is_file() or path.stat().st_size == 0:
        fail(f"missing or empty file: {path.relative_to(ROOT)}")
    return path.read_text(encoding="utf-8")


def main() -> None:
    source = read(ROOT / "mobile-filters.js")
    styles = read(ROOT / "mobile-filters.css")
    html = read(DIST_INDEX)

    required_source_markers = (
        "mobileFiltersToggle",
        "activeFilterChips",
        "resetFiltersBtn",
        "mobile-filters-expanded",
        "medicalBankReviewFilterV1",
        "activeSubtopic",
        "__mobileFilterSync",
    )
    for marker in required_source_markers:
        if marker not in source:
            fail(f"mobile filter source is missing {marker}")

    required_style_markers = (
        ".mobile-filter-toggle",
        ".active-filter-chips",
        ".filter-chip",
        ".reset-filters-button",
        ".mobile-secondary-control",
        "@media(max-width:700px)",
    )
    for marker in required_style_markers:
        if marker not in styles:
            fail(f"mobile filter styles are missing {marker}")

    style_tag = 'id="mobile-filter-styles"'
    script_tag = 'id="mobile-filter-extension"'
    review_tag = 'id="review-filter-extension"'
    for marker in (style_tag, script_tag, review_tag):
        if html.count(marker) != 1:
            fail(f"generated HTML must contain exactly one {marker}")

    if html.index(review_tag) > html.index(script_tag):
        fail("mobile filter extension runs before review filter extension")

    for marker in ("mobileFiltersToggle", "activeFilterChips", "resetFiltersBtn"):
        if marker not in html:
            fail(f"generated mobile filter extension is missing {marker}")

    print("Validated mobile filter integration")


if __name__ == "__main__":
    main()
