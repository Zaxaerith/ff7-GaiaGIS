from dataclasses import dataclass
from pathlib import Path
import hashlib
from .constants import KNOWN

def child_ci(parent: Path, name: str) -> Path | None:
    if not parent.is_dir():
        return None
    matches = [p for p in parent.iterdir() if p.name.casefold() == name.casefold()]
    if len(matches) > 1:
        raise ValueError(f"Ambiguous case-insensitive name {name} under {parent}")
    return matches[0] if matches else None

def descend(parent: Path, parts: tuple[str, ...]) -> Path | None:
    for part in parts:
        parent = child_ci(parent, part)
        if parent is None:
            return None
    return parent

@dataclass(frozen=True)
class SourceDataset:
    selected_path: Path
    wm_directory: Path
    files: dict[str, Path]
    source_type: str  # Layout provenance only; never selects a different parser.

def discover(selected: Path) -> SourceDataset:
    selected = selected.resolve()
    patterns = ((), ("data", "wm"), ("wm",), ("workingdir", "data", "wm"),
                ("ff7", "workingdir", "data", "wm"))
    candidates = []
    for parts in patterns:
        directory = descend(selected, parts)
        if directory is None:
            continue
        found = {name: child_ci(directory, name) for name in KNOWN}
        if all(p is not None and p.is_file() for p in found.values()):
            for name in ("wm0.bot", "wm2.bot", "wm3.bot"):
                p = child_ci(directory, name)
                if p is not None and p.is_file():
                    found[name] = p
            if directory not in [c[0] for c in candidates]:
                candidates.append((directory, found))
    if len(candidates) != 1:
        raise ValueError(f"Expected one complete world dataset, found {len(candidates)} under {selected}")
    directory, found = candidates[0]
    layout = "Steam2026Layout" if tuple(p.casefold() for p in directory.parts[-4:]) == ("ff7", "workingdir", "data", "wm") else "ExtractedDataOrClassicLayout"
    return SourceDataset(selected, directory, found, layout)

def fingerprint(dataset: SourceDataset) -> dict:
    records = []
    for name, path in dataset.files.items():
        digest = hashlib.sha256()
        size = 0
        with path.open("rb") as stream:
            for block in iter(lambda: stream.read(1 << 20), b""):
                size += len(block)
                digest.update(block)
        sha = digest.hexdigest().upper()
        known = KNOWN.get(name)
        records.append(dict(filename=name, path=str(path), size=size, sha256=sha,
                            known_match=(size, sha) == known if known else None))
    compatible = all(r["known_match"] for r in records if r["filename"] in KNOWN)
    return dict(source_type="Steam2026" if compatible else "UnknownCompatibleCandidate",
                layout_type=dataset.source_type, wm_directory=str(dataset.wm_directory), files=records,
                compatibility="known-compatible FF7 2026 dataset" if compatible else "unknown dataset; structural validation required")
