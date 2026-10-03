# SPDX-License-Identifier: GPL-3.0-only
"""Freeze/check V1 and the read-only FF7 source without changing either."""
import hashlib,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'src'))
from gaiagis.dataset import discover,fingerprint
from gaiagis.safety import SOURCE_ROOT

def digest(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda:f.read(1048576),b''):h.update(b)
    return h.hexdigest()

def manifest():
    result={}
    for directory in ['src','tests','config','crs','qgis','web','docs','output/gis','output/3d','output/reconstruction','output/validation']:
        for p in (ROOT/directory).rglob('*'):
            relative=p.relative_to(ROOT)
            if not p.is_file() or any(s in relative.parts for s in ['node_modules','dist','climate','__pycache__']):continue
            if relative.name.startswith('test_climate'):continue
            result[relative.as_posix()]={'size':p.stat().st_size,'sha256':digest(p)}
    for name in ['README.md','LICENSE','THIRD_PARTY_NOTICES.md','pyproject.toml','.gitignore']:
        p=ROOT/name;result[name]={'size':p.stat().st_size,'sha256':digest(p)}
    return result

def main():
    output=ROOT/'output/climate_v2';output.mkdir(parents=True,exist_ok=True)
    baseline=output/'v1-freeze.json'
    if sys.argv[1:]==['freeze']:
        if baseline.exists():raise SystemExit('Freeze already exists; use check, never overwrite baseline')
        data={'v1_files':manifest(),'source':fingerprint(discover(SOURCE_ROOT)),
              'git_tag_created':False,'reason':'Existing repository has uncommitted/untracked V1 files; no tag created.'}
        baseline.write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8')
        print(f'Frozen {len(data["v1_files"])} V1 files; source snapshot saved')
    elif sys.argv[1:]==['check']:
        data=json.loads(baseline.read_text(encoding='utf-8'))
        differences=[n for n,v in data['v1_files'].items() if not (ROOT/n).is_file() or {'size':(ROOT/n).stat().st_size,'sha256':digest(ROOT/n)}!=v]
        source=fingerprint(discover(SOURCE_ROOT))
        unchanged=data['source']['files']==source['files']
        result={'v1_unchanged':not differences,'changed_v1_files':differences,'ff7_source_modified':'NO' if unchanged else 'CHANGE DETECTED',
                'before':data['source'],'after':source,'v1_file_count':len(data['v1_files'])}
        (output/'safety-final.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
        print(f'V1 unchanged: {not differences}; FF7 source modified: {result["ff7_source_modified"]}')
        if differences or not unchanged:raise SystemExit(1)
    else:raise SystemExit('Usage: climate_v2_safety.py freeze|check')
if __name__=='__main__':main()
