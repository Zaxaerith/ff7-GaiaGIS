from dataclasses import dataclass
from pathlib import Path
import hashlib
from .constants import KNOWN, GAME_DATA_LANGUAGES

def archive_key(sources: dict, role: str, *, required=True) -> str | None:
    """Resolve one bounded archive role without aliasing a foreign hash to EN."""
    index = {'world': 0, 'field': 1}[role]
    found = [pair[index] for pair in GAME_DATA_LANGUAGES.values() if pair[index] in sources]
    if len(found) > 1 or required and not found:
        raise ValueError(f'Missing or ambiguous {role} archive source identity')
    other = [pair[1-index] for pair in GAME_DATA_LANGUAGES.values() if pair[1-index] in sources]
    if len(other) > 1 or found and other and (found[0], other[0]) not in [(p[index], p[1-index]) for p in GAME_DATA_LANGUAGES.values()]:
        raise ValueError('Mixed game-data language archive sources')
    return found[0] if found else None

def field_source_keys(sources: dict) -> tuple[str, str]:
    return archive_key(sources, 'field'), 'maplist'

def same_dependencies(previous: dict, current: dict, dependencies) -> bool:
    for dependency in dependencies:
        if dependency in ('@world', '@field'):
            try:
                a = archive_key(previous, dependency[1:]); b = archive_key(current, dependency[1:])
            except ValueError:
                return False
            if a != b or not previous.get(a) or previous[a] != current.get(b):
                return False
        elif previous.get(dependency) != current.get(dependency):
            return False
        elif dependency.endswith('.map') and not previous.get(dependency):
            return False
    return True

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
    language: str = 'en'

    @property
    def world_name(self): return GAME_DATA_LANGUAGES[self.language][0]

    @property
    def field_name(self): return GAME_DATA_LANGUAGES[self.language][1]

    @property
    def world_archive(self): return self.files[self.world_name]

    def field_archive(self, override=None):
        if override is not None:
            path = Path(override).resolve()
            if path.name.casefold() != self.field_name:
                raise ValueError(f'Expected paired Field archive {self.field_name}')
            return path
        directory = child_ci(self.wm_directory.parent, 'field')
        return child_ci(directory, self.field_name) if directory else None

def discover(selected: Path | SourceDataset, game_language: str | None = None) -> SourceDataset:
    if isinstance(selected, SourceDataset):
        if game_language is not None and game_language != selected.language:
            raise ValueError('Conflicting game-data language selection')
        return selected
    game_language = game_language or 'en'
    if game_language not in GAME_DATA_LANGUAGES:
        raise ValueError('Game-data language must be en, fr, de or es')
    selected = Path(selected).resolve()
    patterns = ((), ("data", "wm"), ("wm",), ("workingdir", "data", "wm"),
                ("ff7", "workingdir", "data", "wm"))
    candidates = []; incomplete = []
    for parts in patterns:
        directory = descend(selected, parts)
        if directory is None:
            continue
        found = {name: child_ci(directory, name) for name in ('wm0.map', 'wm2.map', 'wm3.map', GAME_DATA_LANGUAGES[game_language][0])}
        missing = [name for name,path in found.items() if path is None or not path.is_file()]
        if missing and any(path is not None for path in found.values()):incomplete.append((directory,missing))
        if all(p is not None and p.is_file() for p in found.values()):
            for name in ("wm0.bot", "wm2.bot", "wm3.bot"):
                p = child_ci(directory, name)
                if p is not None and p.is_file():
                    found[name] = p
            if directory not in [c[0] for c in candidates]:
                candidates.append((directory, found))
    if len(candidates) != 1:
        if not candidates and incomplete:
            directory,missing=min(incomplete,key=lambda item:len(item[1]))
            raise ValueError(f"Missing required files under {directory}: {', '.join(missing)}")
        raise ValueError(f"Expected one complete world dataset, found {len(candidates)} under {selected}")
    directory, found = candidates[0]
    from .safety import protect_input
    protect_input(directory)
    for path in found.values():protect_input(path)
    for name in ('field','sound'):
        sibling=child_ci(directory.parent,name)
        if sibling and sibling.is_dir():protect_input(sibling)
    layout = "Steam2026Layout" if tuple(p.casefold() for p in directory.parts[-4:]) == ("ff7", "workingdir", "data", "wm") else "ExtractedDataOrClassicLayout"
    return SourceDataset(selected, directory, found, layout, game_language)

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
    compatible = dataset.language == 'en' and all(any(r['filename'] == name and r['known_match'] for r in records) for name in KNOWN)
    return dict(source_type="Steam2026" if compatible else "UnknownCompatibleCandidate",
                layout_type=dataset.source_type, game_data_language=dataset.language,
                archives={'world': dataset.world_name, 'field': dataset.field_name}, wm_directory=str(dataset.wm_directory), files=records,
                compatibility="known-compatible FF7 2026 dataset" if compatible else "unknown dataset; structural validation required")
