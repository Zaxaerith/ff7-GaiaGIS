"""Preview or remove disposable output; never follow filesystem redirects."""
# SPDX-License-Identifier: GPL-3.0-only
import argparse
import os
from pathlib import Path
import shutil
import stat

from .safety import WORKSPACE_ROOT, output_path


def reject_links(path):
    """Reject all reparse points, including Windows junctions, before traversal."""
    path = Path(path)
    if not path.exists() and not path.is_symlink():
        return
    info = path.lstat()
    if stat.S_ISLNK(info.st_mode) or getattr(info, 'st_file_attributes', 0) & 0x400:
        raise ValueError(f'Refusing symlink/junction/reparse point: {path}')
    if path.is_dir():
        for child in path.iterdir():
            reject_links(child)


def checked_output(path):
    """Validate lexical ancestors before resolving; output root itself is not deletable."""
    root = WORKSPACE_ROOT / 'output'
    path = Path(os.path.abspath(path))
    if not path.is_relative_to(root):
        raise ValueError('Only workspace/output can be cleaned')
    for parent in reversed([path, *path.parents]):
        if parent.is_relative_to(root):
            if parent.exists() or parent.is_symlink():
                info = parent.lstat()
                if stat.S_ISLNK(info.st_mode) or getattr(info, 'st_file_attributes', 0) & 0x400:
                    raise ValueError(f'Refusing filesystem redirect: {parent}')
    if output_path(path) != path:
        raise ValueError('Output path was redirected')
    return path


def remove_output(path):
    path = checked_output(path)
    if path == WORKSPACE_ROOT / 'output':
        raise ValueError('Cannot remove output root itself')
    reject_links(path)
    if path.is_dir():
        shutil.rmtree(path)
    elif path.exists():
        path.unlink()


def size(path):
    if path.is_file():
        return path.stat().st_size
    return sum(p.stat().st_size for p in path.rglob('*') if p.is_file())


def plan(include_workspace=False):
    root = checked_output(WORKSPACE_ROOT / 'output')
    reject_links(root)  # Check the whole tree before making the first deletion.
    if not root.exists():
        return []
    result = []
    for path in sorted(root.iterdir()):
        if path.name == 'local-workspace' and not include_workspace:
            continue
        if path.name == 'dev' and path.is_dir():
            result.extend(p for p in sorted(path.iterdir()) if not (p.name == 'STATUS.md' and p.is_file()))
        else:
            result.append(path)
    # An active lifecycle context owns its subtree; refuse rather than break a running job.
    for owner in root.glob('dev/current/*/.owner.pid'):
        pid = int(owner.read_text(encoding='ascii'))
        if _alive(pid):
            raise ValueError(f'Output is in use by PID {pid}; stop the job before cleanup')
    return [(p, size(p)) for p in result]


def _alive(pid):
    if os.name == 'nt':
        import ctypes
        from ctypes import wintypes
        kernel = ctypes.WinDLL('kernel32', use_last_error=True)
        kernel.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
        kernel.OpenProcess.restype = wintypes.HANDLE
        kernel.GetExitCodeProcess.argtypes = [wintypes.HANDLE, ctypes.POINTER(wintypes.DWORD)]
        kernel.CloseHandle.argtypes = [wintypes.HANDLE]
        handle = kernel.OpenProcess(0x1000, False, pid)
        if not handle:
            return ctypes.get_last_error() == 5  # Access denied is conservatively busy.
        try:
            code = wintypes.DWORD()
            return not kernel.GetExitCodeProcess(handle, ctypes.byref(code)) or code.value == 259
        finally:
            kernel.CloseHandle(handle)
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True


def main(argv=None):
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--execute', action='store_true', help='Delete the previewed disposable data')
    cli.add_argument('--all', action='store_true', help='Include regenerable local-workspace')
    args = cli.parse_args(argv)
    try:
        entries = plan(args.all)
        total = sum(n for _, n in entries)
        print('EXECUTE' if args.execute else 'DRY RUN — no files will be deleted')
        for path, count in entries:
            print(f'{count:14,d} bytes  {path.relative_to(WORKSPACE_ROOT)}')
        print(f'Expected release: {total:,} bytes ({total / 1_000_000_000:.3f} GB)')
        if args.execute:
            for path, _ in entries:
                remove_output(path)
            dev = WORKSPACE_ROOT / 'output/dev'
            if dev.is_dir() and not any(dev.iterdir()):
                dev.rmdir()
        return 0
    except (OSError, ValueError) as error:
        print(f'Cleanup refused: {error}')
        return 1
