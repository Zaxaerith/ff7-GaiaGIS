# SPDX-License-Identifier: GPL-3.0-only
"""Freeze/check all existing V1 and V2 bytes and FF7 source fingerprints."""
import hashlib,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'output/climate_v21'
sys.dont_write_bytecode=True;sys.path.insert(0,str(ROOT/'src'))
from gaiagis.dataset import discover,fingerprint
from gaiagis.safety import SOURCE_ROOT
def entry(path):
    h=hashlib.sha256()
    with path.open('rb') as stream:
        for data in iter(lambda:stream.read(1048576),b''):h.update(data)
    return {'size':path.stat().st_size,'sha256':h.hexdigest()}
def read(path):return json.loads(path.read_text(encoding='utf-8'))
def main():
    OUT.mkdir(parents=True,exist_ok=True);path=OUT/'frozen-originals.json'
    if sys.argv[1:]==['freeze']:
        if path.exists():raise SystemExit('Existing freeze must never be replaced')
        v1=read(ROOT/'output/climate_v2/v1-freeze.json')['v1_files']
        changed=[p for p,e in v1.items() if entry(ROOT/p)!=e]
        if changed:raise SystemExit('V1 already differs: '+str(changed))
        v2_sources=read(ROOT/'output/climate_v2/delivery-manifest.json')['new_source_document_files']
        files={**v1,**{e['path']:{'size':e['size'],'sha256':e['sha256']} for e in v2_sources}}
        for p,e in files.items():
            if entry(ROOT/p)!=e:raise SystemExit('Existing V2 source differs from delivered manifest: '+p)
        files.update({p.relative_to(ROOT).as_posix():entry(p) for p in (ROOT/'output/climate_v2').rglob('*') if p.is_file()})
        path.write_text(json.dumps({'files':files,'source':fingerprint(discover(SOURCE_ROOT)),'policy':'V1/V2 frozen; no forbidden platform/model probes'},indent=2)+'\n',encoding='utf-8')
        print(f'Frozen {len(files)} V1/V2 files; FF7 source before snapshot saved')
    elif sys.argv[1:]==['check']:
        old=read(path);changes=[p for p,e in old['files'].items() if not (ROOT/p).exists() or entry(ROOT/p)!=e]
        current=fingerprint(discover(SOURCE_ROOT));unchanged=old['source']['files']==current['files']
        result={'frozen_file_count':len(old['files']),'v1_v2_unchanged':not changes,'changed_files':changes,'ff7_source_modified':'NO' if unchanged else 'CHANGE DETECTED','before':old['source'],'after':current}
        (OUT/'safety-final.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8');print(json.dumps({k:v for k,v in result.items() if k not in ['before','after']}))
        if changes or not unchanged:raise SystemExit(1)
    else:raise SystemExit('Usage: climate_v21_safety.py freeze|check')
if __name__=='__main__':main()
