"""Isolated output runs with non-destructive failure evidence retention."""
# SPDX-License-Identifier: GPL-3.0-only
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import threading
import uuid

from .clean_output import checked_output, reject_links, remove_output
from .safety import WORKSPACE_ROOT


# OutputRun temporarily changes process-wide environment variables. Serialize
# contexts in one process so worker threads cannot restore each other's paths.
_ENVIRONMENT_LOCK = threading.RLock()
_RUN_ID = re.compile(r'[0-9a-f]{32}')


def _timestamp():
    return datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')


def _new_run_id():
    return uuid.uuid4().hex


def _reserve_failure_directory(kind, preferred_run_id=None):
    """Atomically reserve a unique evidence directory; never reuse a name."""
    if not re.fullmatch(r'[a-z][a-z-]*', kind):
        raise ValueError('Invalid output job name')
    parent = checked_output(WORKSPACE_ROOT / 'output/dev')
    parent.mkdir(parents=True, exist_ok=True)
    run_id = preferred_run_id or _new_run_id()
    for _ in range(128):
        if not _RUN_ID.fullmatch(run_id):
            raise ValueError('Invalid output run identifier')
        candidate = parent / f'failed-{kind}-{run_id}'
        try:
            # mkdir is an exclusive reservation on Windows and POSIX. A
            # colliding ID is retried without touching the existing directory.
            candidate.mkdir()
            return run_id, candidate
        except FileExistsError:
            run_id = _new_run_id()
    raise FileExistsError('Unable to reserve a unique failure evidence directory')


def _source_identity():
    commit = os.environ.get('GAIAGIS_SOURCE_COMMIT') or os.environ.get('GITHUB_SHA')
    ref = os.environ.get('GAIAGIS_SOURCE_REF') or os.environ.get('GITHUB_REF')
    if not commit:
        try:
            root = str(WORKSPACE_ROOT)
            result = subprocess.run(
                ['git', '-c', f'safe.directory={Path(root).as_posix()}', '-C', root, 'rev-parse', 'HEAD'],
                check=False,
                capture_output=True,
                text=True,
                timeout=2,
            )
            if result.returncode == 0:
                commit = result.stdout.strip() or None
        except (OSError, subprocess.SubprocessError):
            pass
    return {'commit': commit, 'ref': ref}


class OutputRun:
    def __init__(self, kind, *, keep=False, package_links=False):
        if not re.fullmatch(r'[a-z][a-z-]*', kind):
            raise ValueError('Invalid output job name')
        self.kind, self.keep = kind, keep
        self.package_links = package_links
        self.path = None
        self.environment = {}
        self.run_id = None
        self.started_at_utc = None
        self._lock_held = False

    def __enter__(self):
        if self._lock_held or self.path is not None:
            raise RuntimeError('OutputRun instances cannot be re-entered')
        _ENVIRONMENT_LOCK.acquire()
        self._lock_held = True
        try:
            current = checked_output(WORKSPACE_ROOT / 'output/dev/current')
            current.mkdir(parents=True, exist_ok=True)
            self.run_id = _new_run_id()
            self.started_at_utc = _timestamp()
            self.path = Path(tempfile.mkdtemp(prefix=self.kind + '-', dir=current))
            (self.path / '.owner.pid').write_text(str(os.getpid()), encoding='ascii')
            scratch = self.path / 'tmp'
            scratch.mkdir()
            for key in ('TEMP', 'TMP', 'TMPDIR'):
                self.environment[key] = os.environ.get(key)
            for key in ('TEMP', 'TMP', 'TMPDIR'):
                os.environ[key] = str(scratch)
            return self
        except BaseException:
            self._restore_environment()
            if self.path is not None and self.path.exists():
                try:
                    remove_output(self.path, package_links=self.package_links)
                except (OSError, ValueError):
                    # If even our newly-created scratch tree cannot be safely
                    # removed, leave it in place rather than risk following it.
                    pass
            self._release_lock()
            raise

    def _restore_environment(self):
        for key, value in self.environment.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        self.environment.clear()

    def _release_lock(self):
        if self._lock_held:
            self._lock_held = False
            _ENVIRONMENT_LOCK.release()

    def _failure_record(self, error_type, error, evidence_path, retention_note=None):
        record = {
            'schema': 'gaiagis-output-run-v1',
            'run_id': self.run_id,
            'kind': self.kind,
            'status': 'failed',
            'started_at_utc': self.started_at_utc,
            'finished_at_utc': _timestamp(),
            'pid': os.getpid(),
            'source': _source_identity(),
            'exception': {
                'type': error_type.__name__ if error_type else None,
                'message': str(error)[:4096],
            },
            'evidence_path': str(evidence_path),
        }
        if retention_note:
            record['retention_note'] = retention_note[:1024]
        return record

    @staticmethod
    def _write_new_file(path, text):
        """Create an evidence file without replacing anything already there."""
        try:
            with Path(path).open('x', encoding='utf-8', errors='backslashreplace', newline='\n') as stream:
                stream.write(text)
            return None
        except FileExistsError:
            return 'existing file preserved: ' + str(path)
        except OSError as error:
            return f'{type(error).__name__}: {error}'

    def _write_failure_metadata(self, directory, record):
        payload = json.dumps(record, ensure_ascii=False, indent=2) + '\n'
        return self._write_new_file(Path(directory) / 'run.json', payload)

    def _retain_failure(self, error_type, error):
        self._write_new_file(self.path / '.failure-evidence', (self.run_id or '') + '\n')
        # Test links without traversing them for mutation. A suspicious tree is
        # left in its unique task directory and reported for manual inspection.
        evidence = self.path
        record_directory = self.path
        retention_note = None
        try:
            reject_links(self.path, internal=self.package_links)
        except (OSError, ValueError) as safety_error:
            retention_note = f'Evidence was not moved: {safety_error}'
        (self.path / '.owner.pid').unlink(missing_ok=True)
        if retention_note is None:
            try:
                run_id, archive = _reserve_failure_directory(self.kind, self.run_id)
            except (OSError, ValueError) as reserve_error:
                retention_note = f'Could not reserve archive directory: {reserve_error}'
            else:
                run_path = archive / 'run'
                try:
                    self.path.rename(run_path)
                except OSError as move_error:
                    # Remove only the empty reservation created above.
                    try:
                        archive.rmdir()
                    except OSError:
                        pass
                    retention_note = f'Could not move evidence into archive: {move_error}'
                else:
                    self.run_id = run_id
                    evidence = run_path
                    record_directory = archive

        failure_note = self._write_new_file(evidence / 'failure.txt', str(error)[:4096] + '\n')
        if failure_note:
            retention_note = f'{retention_note}; {failure_note}' if retention_note else failure_note
        record = self._failure_record(error_type, error, evidence, retention_note)
        metadata_error = self._write_failure_metadata(record_directory, record)
        if metadata_error:
            print(f'Failed {self.kind} evidence retained at {evidence}; metadata issue: {metadata_error}')
        elif record_directory == evidence:
            print(f'Failed {self.kind} evidence retained for manual inspection: {evidence}')
        else:
            print(f'Failed {self.kind} evidence retained: {record_directory}')

    def __exit__(self, error_type, error, traceback):
        try:
            self._restore_environment()
            success = error_type is None or (error_type is SystemExit and error.code in (None, 0))
            if self.path is None:
                return False
            if success:
                (self.path / '.owner.pid').unlink(missing_ok=True)
                if not self.keep:
                    remove_output(self.path, package_links=self.package_links)
            else:
                self._retain_failure(error_type, error)
            # Do not remove shared parent directories. Other processes may be
            # creating a run there, and empty parents are harmless.
            return False
        finally:
            self._release_lock()
