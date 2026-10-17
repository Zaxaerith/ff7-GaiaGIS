"""Synthetic tests for task-owned output and failure evidence retention."""
import concurrent.futures
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
from contextlib import ExitStack

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'src'))

from gaiagis import clean_output as clean, output_lifecycle as lifecycle, safety

WORKSPACE = safety.WORKSPACE_ROOT


class OutputTests(unittest.TestCase):
    def setUp(self):
        scratch = WORKSPACE / 'output/dev/current'
        scratch.mkdir(parents=True, exist_ok=True)
        self.tmp = tempfile.TemporaryDirectory(dir=scratch)
        self.root = Path(self.tmp.name) / 'workspace'
        self.root.mkdir()
        self.stack = ExitStack()
        for module in (clean, lifecycle, safety):
            self.stack.enter_context(patch.object(module, 'WORKSPACE_ROOT', self.root))
        self.addCleanup(self.tmp.cleanup)
        self.addCleanup(self.stack.close)

    def failed_run(self, kind='qa', message='synthetic'):
        with self.assertRaisesRegex(RuntimeError, message):
            with lifecycle.OutputRun(kind) as job:
                (job.path / 'evidence').write_text(message)
                raise RuntimeError(message)
        return job

    def junction(self, path, target):
        if os.name == 'nt':
            try:
                subprocess.run(['cmd', '/c', 'mklink', '/J', str(path), str(target)], check=True, capture_output=True)
            except subprocess.CalledProcessError as error:
                self.skipTest('Windows junction creation is unavailable: ' + error.stderr.decode(errors='replace'))
        else:
            path.symlink_to(target, target_is_directory=True)
        self.addCleanup(lambda: os.rmdir(path) if os.name == 'nt' else path.unlink())

    def test_missing_target_creates_unique_failure_record(self):
        self.assertFalse((self.root / 'output').exists())
        with patch.dict(os.environ, {'GAIAGIS_SOURCE_COMMIT': 'synthetic-commit', 'GAIAGIS_SOURCE_REF': 'synthetic-ref'}):
            job = self.failed_run()
        self.assertFalse(job.path.exists())
        archives = list((self.root / 'output/dev').glob('failed-qa-*'))
        self.assertEqual(len(archives), 1)
        archive = archives[0]
        record = json.loads((archive / 'run.json').read_text(encoding='utf-8'))
        self.assertEqual(record['status'], 'failed')
        self.assertEqual(record['kind'], 'qa')
        self.assertEqual(record['run_id'], archive.name.removeprefix('failed-qa-'))
        self.assertEqual(record['exception']['type'], 'RuntimeError')
        self.assertEqual(record['exception']['message'], 'synthetic')
        self.assertEqual(record['source'], {'commit': 'synthetic-commit', 'ref': 'synthetic-ref'})
        self.assertEqual((archive / 'run/evidence').read_text(), 'synthetic')

    def test_failure_evidence_is_captured_when_exception_interrupts_the_run(self):
        with self.assertRaisesRegex(RuntimeError, 'interrupted QA'):
            with lifecycle.OutputRun('qa') as job:
                (job.path / 'partial-result').write_text('keep this')
                raise RuntimeError('interrupted QA')
        archive = next((self.root / 'output/dev').glob('failed-qa-*'))
        record = json.loads((archive / 'run.json').read_text())
        self.assertEqual(record['status'], 'failed')
        self.assertEqual(record['exception']['message'], 'interrupted QA')
        self.assertEqual((archive / 'run/partial-result').read_text(), 'keep this')

    def test_old_failed_directory_and_sentinel_are_untouched(self):
        old = self.root / 'output/dev/current/failed-qa'
        old.mkdir(parents=True)
        sentinel = old / 'sentinel.bin'
        sentinel.write_bytes(b'old failure bytes\x00\xff')
        before = sentinel.read_bytes()
        self.failed_run('qa', 'new failure')
        self.assertTrue(old.is_dir())
        self.assertEqual(sentinel.read_bytes(), before)
        self.assertEqual(len(list((self.root / 'output/dev').glob('failed-qa-*'))), 1)

    def test_consecutive_failures_keep_both_runs(self):
        self.failed_run('qa', 'first')
        self.failed_run('qa', 'second')
        archives = sorted((self.root / 'output/dev').glob('failed-qa-*'))
        self.assertEqual(len(archives), 2)
        self.assertNotEqual(archives[0].name, archives[1].name)
        self.assertEqual(
            {json.loads((p / 'run.json').read_text())['exception']['message'] for p in archives},
            {'first', 'second'},
        )

    def test_run_id_collision_retries_without_overwriting_sentinel(self):
        parent = self.root / 'output/dev'
        parent.mkdir(parents=True)
        collision_id, fresh_id = 'a' * 32, 'b' * 32
        existing = parent / f'failed-qa-{collision_id}'
        existing.mkdir()
        sentinel = existing / 'sentinel'
        sentinel.write_text('keep')
        with patch.object(lifecycle, '_new_run_id', return_value=fresh_id):
            run_id, directory = lifecycle._reserve_failure_directory('qa', collision_id)
        self.assertEqual(run_id, fresh_id)
        self.assertEqual(directory, parent / f'failed-qa-{fresh_id}')
        self.assertEqual(sentinel.read_text(), 'keep')

    def test_concurrent_failure_directory_reservations_are_unique(self):
        (self.root / 'output/dev').mkdir(parents=True)
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            reservations = list(pool.map(lambda _: lifecycle._reserve_failure_directory('qa'), range(32)))
        self.assertEqual(len({run_id for run_id, _ in reservations}), 32)
        self.assertEqual(len({path for _, path in reservations}), 32)
        self.assertTrue(all(path.is_dir() for _, path in reservations))

    def test_concurrent_output_runs_do_not_cross_environment_or_paths(self):
        keys = ('TEMP', 'TMP', 'TMPDIR')
        before = {key: os.environ.get(key) for key in keys}

        def run(index):
            with lifecycle.OutputRun('qa') as job:
                expected = str(job.path / 'tmp')
                if any(os.environ.get(key) != expected for key in keys):
                    raise AssertionError('temporary environment crossed between threads')
                (job.path / str(index)).write_text('synthetic')
                return str(job.path)

        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            paths = list(pool.map(run, range(12)))
        self.assertEqual(len(paths), len(set(paths)))
        self.assertEqual(before, {key: os.environ.get(key) for key in keys})
        self.assertTrue(all(not Path(path).exists() for path in paths))

    def test_success_removes_only_its_temporary_tree(self):
        self.failed_run('smoke', 'retain me')
        legacy = self.root / 'output/dev/current/failed-qa'
        legacy.mkdir(parents=True)
        legacy_sentinel = legacy / 'sentinel'
        legacy_sentinel.write_text('old qa')
        old = self.root / 'output/dev/failed-smoke'
        old.mkdir()
        old_sentinel = old / 'sentinel'
        old_sentinel.write_text('old smoke')
        archive = next((self.root / 'output/dev').glob('failed-smoke-*'))
        archive_bytes = (archive / 'run/evidence').read_bytes()

        with lifecycle.OutputRun('smoke') as job:
            (job.path / 'generated').write_text('temporary')

        self.assertFalse(job.path.exists())
        self.assertEqual(legacy_sentinel.read_text(), 'old qa')
        self.assertEqual(old_sentinel.read_text(), 'old smoke')
        self.assertEqual((archive / 'run/evidence').read_bytes(), archive_bytes)

    def test_active_run_blocks_generic_cleanup(self):
        with lifecycle.OutputRun('smoke') as job:
            (job.path / 'temporary').write_text('active')
            with self.assertRaisesRegex(ValueError, 'in use'):
                clean.plan()
        self.assertFalse(job.path.exists())

    def test_successful_keep_has_no_active_owner_marker(self):
        with lifecycle.OutputRun('qa', keep=True) as job:
            (job.path / 'review').write_text('explicitly retained')
        self.assertTrue(job.path.exists())
        self.assertFalse((job.path / '.owner.pid').exists())
        self.assertIn(job.path, [path for path, _ in clean.plan()])

    def test_keyboard_interrupt_keeps_failure_evidence(self):
        with self.assertRaisesRegex(KeyboardInterrupt, 'interrupted'):
            with lifecycle.OutputRun('qa') as job:
                (job.path / 'evidence').write_text('interrupted evidence')
                raise KeyboardInterrupt('interrupted')
        archive = next((self.root / 'output/dev').glob('failed-qa-*'))
        record = json.loads((archive / 'run.json').read_text())
        self.assertEqual(record['status'], 'failed')
        self.assertEqual(record['exception']['type'], 'KeyboardInterrupt')
        self.assertEqual((archive / 'run/evidence').read_text(), 'interrupted evidence')

    def test_clean_output_does_not_remove_failure_evidence(self):
        direct = self.root / 'output/dev/failed-qa-123'
        direct.mkdir(parents=True)
        direct_sentinel = direct / 'sentinel'
        direct_sentinel.write_text('direct')
        nested = self.root / 'output/dev/current/failed-qa'
        nested.mkdir(parents=True)
        nested_sentinel = nested / 'sentinel'
        nested_sentinel.write_text('legacy')
        leftover = self.root / 'output/dev/current/qa-old'
        leftover.mkdir()
        (leftover / 'tmp').write_text('disposable')
        self.assertEqual(clean.main(['--execute']), 0)
        self.assertEqual(direct_sentinel.read_text(), 'direct')
        self.assertEqual(nested_sentinel.read_text(), 'legacy')
        self.assertFalse(leftover.exists())

    def test_clean_output_dry_run_is_read_only(self):
        for name, value in (
            ('output/old/a', 'fixture'),
            ('output/local-workspace/manifest.json', 'workspace'),
            ('output/dev/STATUS.md', 'status'),
            ('output/dev/log', 'log'),
            ('docs/keep', 'user data'),
        ):
            path = self.root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(value)
        before = {str(path): path.read_bytes() for path in self.root.rglob('*') if path.is_file()}
        self.assertEqual(clean.main([]), 0)
        self.assertEqual(before, {str(path): path.read_bytes() for path in self.root.rglob('*') if path.is_file()})

    def test_clean_output_uses_package_link_policy_for_unique_archives(self):
        archives = []
        for name in ('failed-smoke-' + 'a' * 32, 'failed-package-' + 'b' * 32):
            path = self.root / 'output/dev' / name
            path.mkdir(parents=True)
            archives.append(path)
        with patch.object(clean, 'reject_links', wraps=clean.reject_links) as reject:
            clean.plan()
        calls = {call.args[0]: call.kwargs.get('internal') for call in reject.call_args_list}
        self.assertTrue(all(calls.get(path) is True for path in archives))

    def test_unarchived_failure_is_marked_and_excluded_from_cleanup(self):
        with self.assertRaisesRegex(RuntimeError, 'preserve'):
            with patch.object(lifecycle, '_reserve_failure_directory', side_effect=PermissionError('blocked')):
                with lifecycle.OutputRun('qa') as job:
                    (job.path / 'file').write_text('preserve')
                    raise RuntimeError('preserve')
        self.assertTrue((job.path / '.failure-evidence').is_file())
        self.assertNotIn(job.path, [path for path, _ in clean.plan()])

    def test_redirect_failure_cannot_delete_or_overwrite_outside_data(self):
        external = self.root / 'private-user-data'
        external.mkdir()
        sentinel = external / 'sentinel'
        sentinel.write_bytes(b'keep outside output')
        before = sentinel.read_bytes()
        with self.assertRaisesRegex(RuntimeError, 'redirect'):
            with patch.object(lifecycle, 'reject_links', side_effect=ValueError('synthetic redirect')):
                with lifecycle.OutputRun('qa') as job:
                    raise RuntimeError('redirect')
        self.assertTrue(job.path.exists())
        self.assertTrue((job.path / 'run.json').is_file())
        self.assertEqual(sentinel.read_bytes(), before)

    def test_filesystem_redirect_detection_keeps_external_data(self):
        external = self.root / 'private-user-data'
        external.mkdir()
        sentinel = external / 'sentinel'
        sentinel.write_text('keep')
        redirect = self.root / 'output/redirect'
        redirect.parent.mkdir(parents=True)
        self.junction(redirect, external)
        with self.assertRaises(ValueError):
            clean.reject_links(redirect)
        self.assertEqual(sentinel.read_text(), 'keep')

    def test_success_and_failure_leave_external_user_data_unchanged(self):
        external = self.root / 'private-user-data'
        external.mkdir()
        sentinel = external / 'sentinel'
        sentinel.write_bytes(b'user-owned bytes')
        before = sentinel.read_bytes()
        self.failed_run('qa', 'preserve external')
        with lifecycle.OutputRun('qa') as job:
            (job.path / 'temporary').write_text('owned by this run')
        self.assertEqual(sentinel.read_bytes(), before)
        with self.assertRaises(ValueError):
            clean.remove_output(external)
        self.assertEqual(sentinel.read_bytes(), before)


if __name__ == '__main__':
    unittest.main()
