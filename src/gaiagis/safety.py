from pathlib import Path

WORKSPACE_ROOT = Path(__file__).resolve().parents[2]
SOURCE_ROOT = Path(r"D:\SteamLibrary\steamapps\common\FINAL FANTASY VII Steam Edition")

def output_path(path: Path) -> Path:
    """Resolve junctions/symlinks before authorizing any output, including temp files."""
    resolved = path.resolve()
    if not resolved.is_relative_to(WORKSPACE_ROOT) or resolved.is_relative_to(SOURCE_ROOT.resolve()):
        raise ValueError(f"Output must remain inside {WORKSPACE_ROOT}: {resolved}")
    return resolved
