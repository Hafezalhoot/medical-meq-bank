#!/usr/bin/env python3
"""Fail when generated dependency/cache artifacts are committed to Git."""

from __future__ import annotations

from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[1]
FORBIDDEN_PREFIXES = ("node_modules/", "playwright-report/", "test-results/", "__pycache__/")
FORBIDDEN_NAMES = {".DS_Store"}


def tracked_files() -> list[str]:
    result = subprocess.run(
        ["git", "-c", f"safe.directory={ROOT}", "ls-files", "-z"],
        cwd=ROOT,
        check=True,
        stdout=subprocess.PIPE,
    )
    return [item.decode("utf-8") for item in result.stdout.split(b"\0") if item]


def main() -> None:
    offenders = sorted(
        path
        for path in tracked_files()
        if path.startswith(FORBIDDEN_PREFIXES)
        or Path(path).name in FORBIDDEN_NAMES
        or path.endswith((".pyc", ".pyo"))
    )
    if offenders:
        preview = ", ".join(offenders[:20])
        suffix = f" (+{len(offenders) - 20} more)" if len(offenders) > 20 else ""
        raise SystemExit(f"REPOSITORY HYGIENE FAILED: generated files are tracked: {preview}{suffix}")

    gitignore = (ROOT / ".gitignore").read_text(encoding="utf-8")
    for required in ("node_modules/", "dist/", "test-results/", "playwright-report/", "__pycache__/"):
        if required not in gitignore:
            raise SystemExit(f"REPOSITORY HYGIENE FAILED: .gitignore is missing {required}")

    print("Repository hygiene passed: dependency, report, cache and OS artifacts are not tracked")


if __name__ == "__main__":
    main()
