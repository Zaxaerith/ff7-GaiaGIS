# SPDX-License-Identifier: GPL-3.0-only
"""Freeze V1/V2/V2.1 including their complete output trees; read-only FF7."""
import hashlib,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'output/climate_v22'
sys.dont_write_bytecode=True;sys.path.insert(0,str(ROOT/'src'))
from gaiagis.dataset import discover,fingerprint
from gaiagis.safety import SOURCE_ROOT
def entry(path):return {'size':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest().upper()}
def read(path):return json.loads(path.read_text(encoding='utf-8-sig'))
def main():
    OUT.mkdir(parents=True,exist_ok=True);path=OUT/'frozen-originals.json'
    if sys.argv[1:]==['freeze']:
        if path.exists():raise SystemExit('Refusing to replace an existing freeze')
        old=read(ROOT/'output/climate_v21/frozen-originals.json');files={p:{'size':e['size'],'sha256':e['sha256'].upper()} for p,e in old['files'].items()}
        for p,e in files.items():
            if entry(ROOT/p)!=e:raise SystemExit('Earlier frozen file differs: '+p)
        delivered=read(ROOT/'output/climate_v21/delivery-manifest.json')
        for e in delivered['source_document_files']+delivered['outputs']:
            actual=entry(ROOT/e['path'])
            if actual!={'size':e['size'],'sha256':e['sha256'].upper()}:raise SystemExit('V21 delivered file differs: '+e['path'])
            files[e['path']]=actual
        for p in (ROOT/'output/climate_v21').rglob('*'):
            if p.is_file():files[p.relative_to(ROOT).as_posix()]=entry(p)
        source=fingerprint(discover(SOURCE_ROOT))
        if source['files']!=old['source']['files']:raise SystemExit('FF7 source differs from V21 initial fingerprint')
        path.write_text(json.dumps({'files':files,'source':source,'policy':'Entire V2.1 output/docs/source frozen in addition to V1/V2/Web'},indent=2)+'\n',encoding='utf-8');print('Frozen',len(files),'files; seven FF7 fingerprints captured')
    elif sys.argv[1:]==['check']:
        old=read(path);changes=[p for p,e in old['files'].items() if not (ROOT/p).exists() or entry(ROOT/p)!=e]
        after=fingerprint(discover(SOURCE_ROOT));same=old['source']['files']==after['files']
        result={'frozen_files':len(old['files']),'changed_files':changes,'v1_v2_v21_web_unchanged':not changes,'ff7_source_modified':'NO' if same else 'CHANGE DETECTED','before':old['source'],'after':after}
        (OUT/'safety-final.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8');print({k:v for k,v in result.items() if k not in ['before','after']})
        if changes or not same:raise SystemExit(1)
    else:raise SystemExit('Usage: climate_v22_safety.py freeze|check')
if __name__=='__main__':main()
