"""Read-only inventory for local development and QA output."""

from __future__ import annotations

import argparse
import difflib
import hashlib
import json
import math
import os
import re
import subprocess
from pathlib import Path
from typing import Any


DEFAULT_SCOPES = (
    "output/dev",
    "output/distribution",
    "output/local-workspace",
    "output/exports",
    ".build",
    ".cache",
    "tools",
    "docs/development",
    "tests",
    "web/tests",
    "qgis",
)
SCRIPT_SUFFIXES = {".js", ".mjs", ".py", ".ps1", ".sh"}
VERSION_DIRECTORY = re.compile(r"v\d+(?:\.\d+)*\Z", re.IGNORECASE)
MAX_SCRIPT_BYTES = 1_000_000
SIMILARITY_THRESHOLD = 0.80


def _is_link_or_junction(path: Path) -> bool:
    if path.is_symlink():
        return True
    is_junction = getattr(os.path, "isjunction", None)
    return bool(is_junction and is_junction(path))


def _walk(scope: Path) -> tuple[list[dict[str, Any]], list[str], int]:
    """Return regular files, child directories, and skipped reparse points."""
    files: list[dict[str, Any]] = []
    directories: list[str] = []
    skipped_links = 0
    if not scope.exists() or _is_link_or_junction(scope):
        return files, directories, int(scope.exists())

    for directory, names, filenames in os.walk(scope, topdown=True, followlinks=False):
        current = Path(directory)
        kept_names: list[str] = []
        for name in names:
            child = current / name
            if _is_link_or_junction(child):
                skipped_links += 1
                continue
            kept_names.append(name)
            directories.append(child.relative_to(scope).as_posix())
        names[:] = kept_names

        for name in filenames:
            child = current / name
            if _is_link_or_junction(child):
                skipped_links += 1
                continue
            try:
                size = child.stat().st_size
            except OSError:
                continue
            files.append({"path": child.relative_to(scope).as_posix(), "bytes": size})
    return files, directories, skipped_links


def _directory_usage(
    files: list[dict[str, Any]], directories: list[str]
) -> dict[str, list[dict[str, Any]]]:
    top: dict[str, dict[str, int]] = {}
    second: dict[str, dict[str, int]] = {}

    def ensure(bucket: dict[str, dict[str, int]], key: str) -> dict[str, int]:
        return bucket.setdefault(key, {"files": 0, "bytes": 0})

    for directory in directories:
        parts = directory.split("/")
        ensure(top, parts[0])
        if len(parts) > 1:
            ensure(second, "/".join(parts[:2]))

    for item in files:
        parts = item["path"].split("/")
        first = parts[0] if len(parts) > 1 else "(root files)"
        entry = ensure(top, first)
        entry["files"] += 1
        entry["bytes"] += item["bytes"]
        if len(parts) > 1:
            key = "/".join(parts[:2])
            entry = ensure(second, key)
            entry["files"] += 1
            entry["bytes"] += item["bytes"]

    def rows(bucket: dict[str, dict[str, int]]) -> list[dict[str, Any]]:
        return [
            {"directory": name, **values}
            for name, values in sorted(
                bucket.items(), key=lambda row: (-row[1]["bytes"], row[0])
            )
        ]

    return {"level1": rows(top), "level2": rows(second)}


def _version_script_review(
    root: Path, current_relative: str = "output/dev/current"
) -> dict[str, Any]:
    current = root / current_relative
    if not current.is_dir() or _is_link_or_junction(current):
        return {
            "historical_version_dirs": [],
            "exact_duplicate_scripts": [],
            "similar_script_pairs": [],
            "oversize_scripts_skipped": [],
        }

    versions = sorted(
        child
        for child in current.iterdir()
        if child.is_dir()
        and not _is_link_or_junction(child)
        and VERSION_DIRECTORY.fullmatch(child.name)
    )
    scripts: list[tuple[str, str, list[str]]] = []
    skipped: list[str] = []
    hashes: dict[str, list[str]] = {}

    for version in versions:
        for directory, names, filenames in os.walk(
            version, topdown=True, followlinks=False
        ):
            parent = Path(directory)
            names[:] = [
                name
                for name in names
                if not _is_link_or_junction(parent / name)
            ]
            for name in filenames:
                path = parent / name
                if path.suffix.lower() not in SCRIPT_SUFFIXES or _is_link_or_junction(path):
                    continue
                relative = path.relative_to(root).as_posix()
                size = path.stat().st_size
                if size > MAX_SCRIPT_BYTES:
                    skipped.append(relative)
                    continue
                text = path.read_text(encoding="utf-8", errors="replace")
                digest = hashlib.sha256(path.read_bytes()).hexdigest()
                hashes.setdefault(digest, []).append(relative)
                scripts.append((version.name, relative, text.splitlines()))

    exact = [
        {"sha256": digest, "paths": sorted(paths)}
        for digest, paths in sorted(hashes.items())
        if len(paths) > 1
    ]
    similar: list[dict[str, Any]] = []
    for index, left in enumerate(scripts):
        for right in scripts[index + 1 :]:
            if left[0] == right[0] or left[2] == right[2]:
                continue
            ratio = difflib.SequenceMatcher(
                None, left[2], right[2], autojunk=True
            ).ratio()
            if ratio >= SIMILARITY_THRESHOLD:
                similar.append(
                    {
                        "left": left[1],
                        "right": right[1],
                        "similarity": round(ratio, 3),
                    }
                )
    similar.sort(key=lambda row: (-row["similarity"], row["left"], row["right"]))

    return {
        "historical_version_dirs": [
            child.relative_to(root).as_posix() for child in versions
        ],
        "exact_duplicate_scripts": exact,
        "similar_script_pairs": similar,
        "oversize_scripts_skipped": sorted(skipped),
    }


def _git_paths(root: Path, *arguments: str) -> list[str] | None:
    try:
        result = subprocess.run(
            [
                "git",
                "-c",
                f"safe.directory={root}",
                "-C",
                str(root),
                "ls-files",
                "-z",
                *arguments,
            ],
            check=False,
            capture_output=True,
        )
    except OSError:
        return None
    if result.returncode:
        return None
    return [os.fsdecode(item) for item in result.stdout.split(b"\0") if item]


def _git_status(root: Path, scopes: tuple[str, ...]) -> dict[str, Any]:
    tracked = _git_paths(root)
    untracked = _git_paths(root, "--others", "--exclude-standard")
    ignored = _git_paths(root, "--others", "--ignored", "--exclude-standard")
    if tracked is None or untracked is None or ignored is None:
        return {"available": False, "reason": "Git index unavailable"}

    def under(path: str, scope: str) -> bool:
        normalized = path.replace("\\", "/")
        prefix = scope.strip("/") + "/"
        return normalized == scope.strip("/") or normalized.startswith(prefix)

    return {
        "available": True,
        "tracked_files": len(tracked),
        "untracked_files": len(untracked),
        "ignored_files": len(ignored),
        "by_scope": {
            scope: {
                "tracked": sum(under(path, scope) for path in tracked),
                "untracked": sum(under(path, scope) for path in untracked),
                "ignored": sum(under(path, scope) for path in ignored),
            }
            for scope in scopes
        },
    }


def audit_workspace(
    root: Path,
    scopes: tuple[str, ...] = DEFAULT_SCOPES,
    *,
    large_file_mib: float = 16.0,
) -> dict[str, Any]:
    """Inventory known workspace roots without writing or removing anything."""
    root = root.resolve()
    scope_rows: list[dict[str, Any]] = []
    all_files: list[dict[str, Any]] = []
    for relative in scopes:
        scope = root / relative
        if not scope.resolve(strict=False).is_relative_to(root):
            raise ValueError(f"Scope escapes repository root: {relative}")
        normalized = relative.replace("\\", "/")
        files, directories, skipped_links = _walk(scope)
        total = sum(item["bytes"] for item in files)
        row = {
            "path": relative.replace("\\", "/"),
            "exists": scope.exists(),
            "files": len(files),
            "directories": len(directories),
            "bytes": total,
            "directory_usage": _directory_usage(files, directories),
            "skipped_links_or_junctions": skipped_links,
        }
        scope_rows.append(row)
        all_files.extend(
            {"path": f"{normalized}/{item['path']}", "bytes": item["bytes"]}
            for item in files
        )

    threshold = int(large_file_mib * 1024 * 1024)
    largest = sorted(all_files, key=lambda item: (-item["bytes"], item["path"]))[:30]
    large = sorted(
        (item for item in all_files if item["bytes"] >= threshold),
        key=lambda item: (-item["bytes"], item["path"]),
    )
    total_bytes = sum(item["bytes"] for item in all_files)
    return {
        "schema": "gaiagis-workspace-audit-v1",
        "root": str(root),
        "no_mutations_performed": True,
        "scope_totals": {
            "files": len(all_files),
            "directories": sum(row["directories"] for row in scope_rows),
            "bytes": total_bytes,
        },
        "scopes": scope_rows,
        "largest_30_files": largest,
        "large_files_review_required": large,
        "git": _git_status(root, scopes),
        "versioned_script_review": _version_script_review(root),
        "cleanup_recommendations": [],
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Print a read-only inventory of local GaiaGIS development output."
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
        help="repository root (default: the parent of tools/)",
    )
    parser.add_argument(
        "--large-mib",
        type=float,
        default=16.0,
        help="report files at or above this size for review; never deletes them",
    )
    args = parser.parse_args(argv)
    if not math.isfinite(args.large_mib) or args.large_mib <= 0:
        parser.error("--large-mib must be a finite positive number")
    report = audit_workspace(args.root, large_file_mib=args.large_mib)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
