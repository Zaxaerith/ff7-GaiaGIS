# SPDX-License-Identifier: GPL-3.0-only
"""Audit the V2 delivery without changing the frozen V1 or source assets."""
import hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'output/climate_v2'
def read(path):return json.loads(path.read_text(encoding='utf-8'))
def entry(path):
    h=hashlib.sha256()
    with path.open('rb') as stream:
        for data in iter(lambda:stream.read(1048576),b''):h.update(data)
    return {'path':path.relative_to(ROOT).as_posix(),'size':path.stat().st_size,'sha256':h.hexdigest()}
sources=[]
for directory in ['src/gaiagis/climate','config/climate','docs/climate','research/climate']:
    sources.extend(p for p in (ROOT/directory).rglob('*') if p.is_file() and '__pycache__' not in p.parts)
sources.extend((ROOT/'tests').glob('test_climate*.py'));sources.extend((ROOT/'scripts').glob('climate*.py'));sources.append(ROOT/'scripts/run_exoplasim_external.py')
products=[p for p in OUT.rglob('*') if p.is_file() and p.name!='delivery-manifest.json' and p.suffix not in ['.exe']]
safety=read(OUT/'safety-final.json');tests=read(OUT/'tests.json');recommendation=read(OUT/'latitude_mapping.json')
if not safety['v1_unchanged'] or safety['ff7_source_modified']!='NO' or not tests['successful']:raise SystemExit('Delivery cannot pass with failed tests or changed inputs/V1')
manifest={'status':'Level A complete; GCM validation pending','recommended_mapping':recommendation['recommended']['name'],
          'model_signature':read(OUT/'run-settings.json')['signature'],'tests':tests,
          'source_root':safety['before']['wm_directory'],'ff7_source_modified':safety['ff7_source_modified'],
          'frozen_v1_files':safety['v1_file_count'],'v1_final_hashes_unchanged':safety['v1_unchanged'],
          'temporary_fixture_audit':read(OUT/'fixture-recovery/recovery.json'),
          'new_source_document_files':[entry(p) for p in sorted(set(sources))],
          'products':[entry(p) for p in sorted(products)]}
(OUT/'delivery-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
print(f'Delivery audited: {len(set(sources))} new code/config/test/research/document files; {len(products)} V2 artifacts; tests={tests["tests"]}; FF7 source modified: NO')
