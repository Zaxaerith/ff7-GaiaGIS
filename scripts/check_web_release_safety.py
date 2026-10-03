# SPDX-License-Identifier: GPL-3.0-only
"""Read-only historical/source audit; no climate execution or asset generation."""
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output' / 'web_release_v1'


def fingerprint(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1 << 20), b''):
            digest.update(chunk)
    return {'size': path.stat().st_size, 'sha256': digest.hexdigest()}


def main():
    baseline = json.loads((OUT / 'preservation-before.json').read_text(encoding='utf-8'))
    changes, missing = [], []
    for relative, old in baseline.items():
        path = (ROOT / relative).resolve()
        if not path.is_relative_to(ROOT):
            raise RuntimeError('Manifest path escaped workspace')
        if not path.is_file():
            missing.append(relative)
        elif fingerprint(path) != old:
            changes.append(relative)
    expected = ['docs/climate/README.md']
    # This task begins from the last completed phase's verified source record.
    # It is a reference baseline, not a newly fabricated observation timestamp.
    source_baseline = json.loads((OUT / 'source-before.json').read_text(encoding='utf-8'))['after']['files']
    sources = []
    for old in source_baseline:
        now = fingerprint(Path(old['path']))
        equal = now['size'] == old['size'] and now['sha256'].upper() == old['sha256'].upper()
        sources.append({'filename': old['filename'], 'path': old['path'], 'baseline': {'size': old['size'], 'sha256': old['sha256']}, 'current': now, 'unchanged': equal})
    command = ['git', '-c', f'safe.directory={ROOT.as_posix()}', '-c', 'core.autocrlf=true']
    historical_source_changes = subprocess.check_output(command + ['diff', 'c9f7ccd', '--name-only', '--', 'src/gaiagis/climate', 'config/climate', 'research/climate', 'scripts/climate_v2.py', 'scripts/climate_v21.py', 'scripts/climate_v22.py'], cwd=ROOT, text=True).splitlines()
    report = {'historical_files_checked': len(baseline), 'unchanged': len(baseline)-len(changes)-len(missing), 'changed': changes, 'intended_status_update': expected, 'missing': missing, 'historical_source_changes': historical_source_changes, 'source_baseline_kind': 'Last verified V2.2 delivery record, preserved at Web task start', 'ff7_source_modified': 'NO' if all(s['unchanged'] for s in sources) else 'HASH MISMATCH', 'source_comparison': sources, 'success': not missing and changes == expected and not historical_source_changes and all(s['unchanged'] for s in sources)}
    (OUT / 'safety-final.json').write_text(json.dumps(report, indent=2)+'\n', encoding='utf-8')
    print(json.dumps({key: value for key, value in report.items() if key != 'source_comparison'}, indent=2))
    if not report['success']:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
