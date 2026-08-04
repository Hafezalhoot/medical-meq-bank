#!/usr/bin/env python3
"""Validate mobile-filter sources and both generated delivery modes."""

from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
DIST_INDEX = DIST / "index.html"
OFFLINE = DIST / "offline" / "Medical_MEQ_Review_Bank_Offline.html"


def fail(message: str) -> None:
    raise SystemExit(f"MOBILE FILTER VALIDATION FAILED: {message}")


def read(path: Path) -> str:
    if not path.is_file() or path.stat().st_size == 0:
        fail(f"missing or empty file: {path.relative_to(ROOT)}")
    return path.read_text(encoding="utf-8")


def require_markers(source: str, markers: tuple[str, ...], label: str) -> None:
    for marker in markers:
        if marker not in source:
            fail(f"{label} is missing {marker}")


def require_exactly_once(source: str, marker: str, label: str) -> None:
    count = source.count(marker)
    if count != 1:
        fail(f"{label} must contain exactly one {marker!r}; found {count}")


def main() -> None:
    source_js = read(ROOT / "mobile-filters.js")
    source_css = read(ROOT / "mobile-filters.css")
    online_js = read(DIST / "mobile-filters.js")
    online_css = read(DIST / "mobile-filters.css")
    online_html = read(DIST_INDEX)
    offline_html = read(OFFLINE)

    required_source_markers = (
        "mobileFiltersToggle",
        "activeFilterChips",
        "resetFiltersBtn",
        "mobile-filters-expanded",
        "mobileFilterBackdrop",
        "mobileFilterSheetTitle",
        "applyMobileFiltersBtn",
        "mobile-filters-open",
        "lockPageScroll",
        "trapFocus",
        "medicalBankReviewFilterV1",
        "activeSubtopic",
        "__mobileFilterSync",
    )
    required_style_markers = (
        ".mobile-filter-toggle",
        ".active-filter-chips",
        ".filter-chip",
        ".reset-filters-button",
        ".mobile-filter-backdrop",
        ".mobile-filter-sheet-header",
        ".mobile-filter-footer",
        ".mobile-sheet-control",
        "body.mobile-filters-open",
        "@media(max-width:700px)",
    )
    require_markers(source_js, required_source_markers, "mobile filter source")
    require_markers(source_css, required_style_markers, "mobile filter styles")

    if online_js != source_js:
        fail("published mobile-filters.js does not exactly match its reviewable source")
    if online_css != source_css:
        fail("published mobile-filters.css does not exactly match its reviewable source")

    online_style = '<link id="mobile-filter-styles" rel="stylesheet" href="./mobile-filters.css">'
    online_script = '<script id="mobile-filter-extension" src="./mobile-filters.js"></script>'
    online_review = '<script id="review-filter-extension" src="./review-filter.js"></script>'
    for marker, label in (
        (online_style, "online HTML"),
        (online_script, "online HTML"),
        (online_review, "online HTML"),
    ):
        require_exactly_once(online_html, marker, label)

    if online_html.index(online_review) > online_html.index(online_script):
        fail("online mobile filter extension loads before review filter extension")
    if '<script id="mobile-filter-extension">' in online_html:
        fail("online HTML embeds mobile filter JavaScript instead of using the external file")
    if '<style id="mobile-filter-styles">' in online_html:
        fail("online HTML embeds mobile filter CSS instead of using the external file")

    offline_style = '<style id="mobile-filter-styles">'
    offline_script = '<script id="mobile-filter-extension">'
    offline_review = '<script id="review-filter-extension">'
    for marker in (offline_style, offline_script, offline_review):
        require_exactly_once(offline_html, marker, "standalone offline HTML")

    if offline_html.index(offline_review) > offline_html.index(offline_script):
        fail("offline mobile filter extension runs before review filter extension")
    if 'href="./mobile-filters.css"' in offline_html:
        fail("standalone offline HTML still depends on mobile-filters.css")
    if 'src="./mobile-filters.js"' in offline_html:
        fail("standalone offline HTML still depends on mobile-filters.js")

    require_markers(
        offline_html,
        ("mobileFiltersToggle", "activeFilterChips", "resetFiltersBtn"),
        "standalone offline mobile filter runtime",
    )
    require_markers(
        offline_html,
        (".mobile-filter-toggle", ".active-filter-chips", ".filter-chip"),
        "standalone offline mobile filter styles",
    )

    print("Validated external online and embedded offline mobile filter integration")


if __name__ == "__main__":
    main()
