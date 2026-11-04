"""Short-offline, journalled Field CFG replacement, not a multi-file FS transaction.

The loopback server and migration share an exclusive OS lease. External readers
must also stop; readers that ignore this lease get no atomicity guarantee.
"""
# SPDX-License-Identifier: GPL-3.0-only
from contextlib import contextmanager
import hashlib
import json
import os
from pathlib import Path
import uuid

from .field_interaction import atomic_write
from .safety import output_path

FILES = ('gaia-field-context.json', 'gaia-field-interaction.bin',
         'gaia-field-script-evidence.bin', 'gaia-gameplay.json',
         'gaia-field-dialogue.bin', 'gaia-workspace.json')
JOURNAL = '.build/field-cfg-transaction.json'


def digest(data):
    return hashlib.sha256(data).hexdigest()


@contextmanager
def workspace_lease(root):
    root = output_path(Path(root))
    path = output_path(root/'.build/field-cfg.lock')
    path.parent.mkdir(parents=True, exist_ok=True)
    stream = path.open('a+b')
    try:
        if path.stat().st_size == 0:
            stream.write(b'0'); stream.flush()
        stream.seek(0)
        try:
            if os.name == 'nt':
                import msvcrt
                msvcrt.locking(stream.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(stream.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            raise ValueError('Workspace busy: stop its loopback server before CFG migration') from None
        yield root
    finally:
        # Closing releases the OS lock even on a killed process.
        stream.close()


def _read_journal(root, path):
    if path.stat().st_size > 32_000:
        raise ValueError('CFG journal budget')
    j = json.loads(path.read_bytes())
    if j.get('version') != 1 or not isinstance(j.get('id'), str) or len(j['id']) != 32 or any(c not in '0123456789abcdef' for c in j['id']):
        raise ValueError('CFG journal identity')
    rows = j.get('files')
    if not isinstance(rows, list) or not rows or [r.get('name') for r in rows] != [n for n in FILES if any(r.get('name') == n for r in rows)]:
        raise ValueError('CFG journal file set')
    if rows[-1]['name'] != 'gaia-workspace.json':
        raise ValueError('CFG journal lacks final Manifest')
    backup = output_path(root/'.build/recovery/field-cfg'/j['id'])
    for row in rows:
        if any(not isinstance(row.get(k), str) or len(row[k]) != 64 or any(c not in '0123456789abcdef' for c in row[k]) for k in ('old', 'new')):
            raise ValueError('CFG journal checksum')
        if digest((backup/row['name']).read_bytes()) != row['old']:
            raise ValueError('CFG recovery backup checksum')
        current = root/row['name']
        if not current.is_file() or digest(current.read_bytes()) not in (row['old'], row['new']):
            raise ValueError('CFG recovery refuses externally modified asset')
    return j, backup


def recover(root, *, rollback=False):
    """Caller holds lease. Idempotent before any server/reader opens a Manifest."""
    root = Path(root)
    path = output_path(root/JOURNAL)
    if not path.exists():
        return 'clean'
    j, backup = _read_journal(root, path)
    complete = all(digest((root/r['name']).read_bytes()) == r['new'] for r in j['files'])
    if rollback or not complete:
        for row in j['files']:
            atomic_write(root/row['name'], (backup/row['name']).read_bytes())
        outcome = 'restored-old'
    else:
        outcome = 'verified-new'
    # The recovery receipt contains hashes and names only, never game text.
    atomic_write(backup/'receipt.json', json.dumps(j, sort_keys=True).encode())
    path.unlink()
    return outcome


def commit(root, candidates, snapshot, *, fault=lambda point: None):
    """Caller holds lease and has strictly read back every staged candidate.

    Exception rolls back. Process death/BaseException leaves the journal for
    startup recovery. Manifest is always last; backups cover only changed files.
    """
    root = Path(root)
    names = [n for n in FILES if n in candidates]
    if not names or names[-1] != 'gaia-workspace.json' or set(candidates) != set(names) or set(snapshot) != set(names):
        raise ValueError('CFG transaction bounded file set')
    if (root/JOURNAL).exists():
        raise ValueError('CFG recovery required')
    for name in names:
        if digest((root/name).read_bytes()) != snapshot[name]:
            raise ValueError('Workspace changed before CFG commit')
    ident = uuid.uuid4().hex
    backup = output_path(root/'.build/recovery/field-cfg'/ident)
    backup.mkdir(parents=True)
    rows = []
    for name in names:
        fault('backup:'+name)
        original = (root/name).read_bytes()
        if digest(original) != snapshot[name]:
            raise ValueError('Workspace changed during CFG backup')
        atomic_write(backup/name, original)
        if digest((backup/name).read_bytes()) != snapshot[name]:
            raise ValueError('CFG backup readback failed')
        rows.append(dict(name=name, old=snapshot[name], new=digest(candidates[name])))
    journal = dict(version=1, id=ident, files=rows)
    for name in names:
        if digest((root/name).read_bytes()) != snapshot[name]:
            raise ValueError('Workspace changed after CFG backup')
    atomic_write(root/JOURNAL, json.dumps(journal, sort_keys=True).encode())
    try:
        for name in names:
            fault('before:'+name)
            atomic_write(root/name, candidates[name])
            fault('after:'+name)
        recover(root)
    except Exception:
        recover(root, rollback=True)
        raise
    return ident


def rollback(root, ident):
    """Explicit, source-snapshot-checked rollback of a completed migration."""
    if len(ident) != 32 or any(c not in '0123456789abcdef' for c in ident):
        raise ValueError('CFG rollback identity')
    backup = output_path(Path(root)/'.build/recovery/field-cfg'/ident)
    receipt = backup/'receipt.json'
    _read_journal(Path(root), receipt)
    atomic_write(Path(root)/JOURNAL, receipt.read_bytes())
    return recover(root, rollback=True)
