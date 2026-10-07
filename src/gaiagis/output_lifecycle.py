"""Disposable job directories: success cleans up; failure retains only the last job."""
# SPDX-License-Identifier: GPL-3.0-only
import os
import re
import tempfile
from pathlib import Path

from .clean_output import checked_output, reject_links, remove_output
from .safety import WORKSPACE_ROOT


class OutputRun:
    def __init__(self, kind, *, keep=False):
        if not re.fullmatch(r'[a-z][a-z-]*', kind):
            raise ValueError('Invalid output job name')
        self.kind, self.keep = kind, keep
        self.path = None
        self.environment = {}

    def __enter__(self):
        current = checked_output(WORKSPACE_ROOT / 'output/dev/current')
        current.mkdir(parents=True, exist_ok=True)
        self.path = Path(tempfile.mkdtemp(prefix=self.kind + '-', dir=current))
        (self.path / '.owner.pid').write_text(str(os.getpid()), encoding='ascii')
        scratch = self.path / 'tmp'
        scratch.mkdir()
        for key in ('TEMP', 'TMP', 'TMPDIR'):
            self.environment[key] = os.environ.get(key)
            os.environ[key] = str(scratch)
        return self

    def __exit__(self, error_type, error, traceback):
        for key, value in self.environment.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        failure = checked_output(WORKSPACE_ROOT / 'output/dev' / ('failed-' + self.kind))
        (self.path / '.owner.pid').unlink(missing_ok=True)
        if error_type is None or (error_type is SystemExit and error.code in (None, 0)):
            if not self.keep:
                remove_output(self.path)
            if failure.exists():
                remove_output(failure)
        else:
            reject_links(self.path)
            if failure.exists():
                remove_output(failure)
            (self.path / 'failure.txt').write_text(str(error)[:4096] + '\n', encoding='utf8')
            self.path.rename(failure)
            print(f'Failed {self.kind} evidence retained: {failure}')
        current = WORKSPACE_ROOT / 'output/dev/current'
        if current.is_dir() and not any(current.iterdir()):
            current.rmdir()
        dev = WORKSPACE_ROOT / 'output/dev'
        if dev.is_dir() and not any(dev.iterdir()):
            dev.rmdir()
        return False
