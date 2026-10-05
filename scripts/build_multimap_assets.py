# SPDX-License-Identifier: GPL-3.0-only
"""Generate optional native maps/textures/transitions from user's installation."""
import argparse
import hashlib
import json
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'src'))
from gaiagis.dataset import discover,child_ci
from gaiagis.map_reader import parse_map
from gaiagis.native_export import export_native
from gaiagis.texture_pack import build_texture_pack,catalog
from gaiagis.lgp import inventory,read_entry
from gaiagis.map_transitions import analyze_transitions,engine_links
from gaiagis.poi import parse_field_table,parse_maplist

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source');parser.add_argument('--output',type=Path,default=ROOT/'output/v1_8/data')
    args=parser.parse_args();out=args.output.resolve()
    if not out.is_relative_to(ROOT):raise ValueError('Output must remain in workspace')
    out.mkdir(parents=True,exist_ok=True);ds=discover(Path(args.source));lgp=ds.files['world_us.lgp']
    entries={e['filename'].casefold():e for e in inventory(lgp)['entries']}
    # Field destinations remain exact internal IDs even when maplist is unavailable.
    field_dir=child_ci(ds.wm_directory.parent,'field')
    field_archive=child_ci(field_dir,'flevel.lgp') if field_dir else None
    if not field_archive:raise ValueError('Field archive/maplist required for exact field identity')
    field_entry=next(e for e in inventory(field_archive)['entries'] if e['filename'].casefold()=='maplist')
    maplist=read_entry(field_archive,field_entry)
    table_data=read_entry(lgp,entries['field.tbl'])
    table=parse_field_table(table_data,parse_maplist(maplist))
    records=engine_links();report={};sources={'field.tbl':hashlib.sha256(table_data).hexdigest(),'maplist':hashlib.sha256(maplist).hexdigest()}
    for map_id in (0,2,3):
        identity=f'WM{map_id}';world=parse_map(ds.files[identity.lower()+'.map'],map_id)
        payload=read_entry(lgp,entries[identity.lower()+'.ev'])
        found,analysis=analyze_transitions(payload,world,table);records.extend(found)
        sources[identity.lower()+'.map']=hashlib.sha256(world.path.read_bytes()).hexdigest()
        sources[identity.lower()+'.ev']=hashlib.sha256(payload).hexdigest()
        if map_id:
            meta=export_native(world,out/f'gaia-map-{identity}.bin')
            textures=build_texture_pack(args.source,out/f'gaia-map-{identity}.json',out/f'gaia-textures-{identity}.bin',identity)
            report[identity]=dict(map=meta,textures=textures)
    sources['world_us.lgp']=hashlib.sha256(lgp.read_bytes()).hexdigest()
    transitions=dict(schema='gaiagis-map-transitions',version=1,sources=sources,transitions=sorted(records,key=lambda r:r['id']),
                     global_mapping={'WM2':None,'WM3':None},runtime_equivalence='NOT VERIFIED')
    (out/'gaia-transitions.json').write_text(json.dumps(transitions,sort_keys=True,indent=2),encoding='utf8')
    (out/'build-report.json').write_text(json.dumps(report,sort_keys=True,indent=2),encoding='utf8')
    print(json.dumps({k:dict(triangles=v['map']['triangle_count'],map_bytes=v['map']['bytes'],textures=v['textures']) for k,v in report.items()},indent=2))

if __name__=='__main__':main()
