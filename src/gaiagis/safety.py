from pathlib import Path
import os
import sys

WORKSPACE_ROOT = Path(sys.executable).resolve().parent if getattr(sys, 'frozen', False) else Path(__file__).resolve().parents[2]
SOURCE_ROOT = Path(os.environ.get('GAIAGIS_SOURCE_ROOT', str(WORKSPACE_ROOT / 'readonly-inputs')))
_readonly_roots = {SOURCE_ROOT.resolve()}

def protect_input(path):
    """Selected installations are read-only, including installations inside checkout."""
    _readonly_roots.add(Path(path).resolve())

def output_path(path: Path) -> Path:
    """Resolve junctions/symlinks before authorizing any output, including temp files."""
    resolved = path.resolve()
    if not resolved.is_relative_to(WORKSPACE_ROOT) or any(resolved.is_relative_to(root) for root in _readonly_roots):
        raise ValueError(f"Output must remain inside {WORKSPACE_ROOT}: {resolved}")
    return resolved
