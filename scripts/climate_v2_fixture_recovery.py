# SPDX-License-Identifier: GPL-3.0-only
"""Restore one regenerated SQLite test fixture only when its original hash matches.

The legacy CRS test creates a fresh empty GPKG with a nondeterministic timestamp.
All authoritative V1 outputs are unchanged. Never revise the frozen manifest.
"""
from datetime import datetime,timedelta,timezone
import hashlib,json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
relative='output/reconstruction/test_crs/wkt2.gpkg';path=(ROOT/relative).resolve()
if path!=ROOT/'output/reconstruction/test_crs/wkt2.gpkg':raise SystemExit('Unexpected fixture path')
manifest=json.loads((ROOT/'output/climate_v2/v1-freeze.json').read_text())
expected=manifest['v1_files'][relative]['sha256'];data=path.read_bytes();before=hashlib.sha256(data).hexdigest()
out=ROOT/'output/climate_v2/fixture-recovery';out.mkdir(parents=True,exist_ok=True)
(out/'regenerated-fixture.gpkg').write_bytes(data)
stamps=set(re.findall(rb'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z',data))
if len(stamps)!=1:raise SystemExit(f'Cannot safely infer single timestamp: {stamps}')
stamp=next(iter(stamps));position=data.find(stamp)
if data.count(stamp)!=1:raise SystemExit('Ambiguous timestamp occurrences')
center=datetime.fromtimestamp((ROOT/'output/reconstruction/tests.log').stat().st_mtime,timezone.utc)
start=(center-timedelta(seconds=120)).replace(microsecond=0);restored=None
# Candidate bytes are held in memory. Only an exact full-file SHA match is saved.
for ms in range(121000):
    instant=start+timedelta(milliseconds=ms)
    candidate_stamp=instant.strftime('%Y-%m-%dT%H:%M:%S.')+f'{instant.microsecond//1000:03d}Z'
    candidate=data[:position]+candidate_stamp.encode()+data[position+len(stamp):]
    if hashlib.sha256(candidate).hexdigest()==expected:
        restored=candidate_stamp;path.write_bytes(candidate);break
result={'fixture':relative,'regenerated_sha256':before,'frozen_sha256':expected,'restored_timestamp':restored,
        'restored_exact_frozen_bytes':restored is not None,'method':'Full-file hash-gated recovery of only the empty generated CRS test fixture timestamp',
        'source_assets_touched':False,'baseline_manifest_changed':False}
(out/'recovery.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8');print(json.dumps(result))
if restored is None:raise SystemExit('Original bytes not recovered; record difference honestly, no baseline override')
