"""Compare the immutable task-start record with current read-only fingerprints."""
import sys
from pathlib import Path
import json
from datetime import datetime,timezone
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'src'))
from gaiagis.dataset import discover,fingerprint
from gaiagis.cli import write_json

source=Path(sys.argv[1])
directory=ROOT/'output'/'validation'
start=json.loads((directory/'source_before.json').read_text(encoding='utf-8-sig'))
end=fingerprint(discover(source))
old={r['filename']:r for r in start['files']}
comparison=[]
for record in end['files']:
    baseline=old[record['filename']]
    comparison.append(dict(filename=record['filename'],size_before=baseline['size'],size_after=record['size'],
        sha256_before=baseline['sha256'],sha256_after=record['sha256'],
        unchanged=(baseline['size'],baseline['sha256'])==(record['size'],record['sha256']),
        known_reference_match=record['known_match']))
unchanged=all(r['unchanged'] for r in comparison)
result=dict(task_before=start,task_after=end,comparison=comparison,
            checked_at_utc=datetime.now(timezone.utc).isoformat(),
            source_modified=not unchanged,statement='FF7 source modified: NO' if unchanged else 'SOURCE HASH CHANGED',
            scope='Four core files plus three BOT files; no claim of whole-installation hash census')
write_json(directory/'source_fingerprint.json',result)
print(result['statement'])
for row in comparison: print(row['filename'],row['size_before'],row['size_after'],row['unchanged'],row['sha256_after'])
raise SystemExit(0 if unchanged else 1)
