from pathlib import Path
import os
import sys

def runtime_roots(executable, *, frozen=False, platform=sys.platform, workspace=None, home=None):
    """Resolve once, before importing exporters; never derive Mac writes from cwd."""
    if not frozen:
        root = Path(__file__).resolve().parents[2]
        return root, root
    executable = Path(executable).resolve()
    if platform != 'darwin':
        return executable.parent, executable.parent
    contents = executable.parent.parent
    if executable.parent.name != 'MacOS' or contents.name != 'Contents' or contents.parent.suffix != '.app':
        raise ValueError('macOS portable executable must be inside GaiaGIS.app/Contents/MacOS')
    resources = (contents / 'Resources').resolve()
    root = Path(workspace) if workspace else Path(home or Path.home()) / 'Library/Application Support/GaiaGIS'
    if not root.is_absolute():
        raise ValueError('GAIAGIS_WORKSPACE_ROOT must be an absolute path')
    for parent in (root,*root.parents):
        if parent.is_symlink() or parent.exists() and getattr(parent.lstat(),'st_file_attributes',0)&0x400:
            raise ValueError('Workspace root cannot be redirected by filesystem links')
    root = root.resolve()
    bundle = contents.parent.resolve()
    if root == Path(root.anchor) or root == Path(home or Path.home()).resolve() or root.is_relative_to(bundle) or bundle.is_relative_to(root):
        raise ValueError('Workspace must be a dedicated directory separate from the application bundle')
    return resources, root


RESOURCE_ROOT, WORKSPACE_ROOT = runtime_roots(sys.executable, frozen=bool(getattr(sys, 'frozen', False)),
                                            workspace=os.environ.get('GAIAGIS_WORKSPACE_ROOT'))
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


def resource_path(path: Path) -> Path:
    """Read-only application resources have their own boundary, not write permission."""
    resolved = Path(path).resolve()
    if not resolved.is_relative_to(RESOURCE_ROOT):
        raise ValueError('Application resource escaped its root')
    return resolved
