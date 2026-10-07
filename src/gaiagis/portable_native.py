# SPDX-License-Identifier: GPL-3.0-only
"""Frozen runtime adapter for existing native exporters; no external scripts."""
import hashlib,json
from gaiagis.dataset import discover,child_ci
from gaiagis.map_reader import parse_map
from gaiagis.native_export import export_native
from gaiagis.texture_pack import build_texture_pack,catalog
from gaiagis.lgp import inventory,read_entry
from gaiagis.map_transitions import analyze_transitions,engine_links
from gaiagis.poi import parse_field_table,parse_maplist

def build_native_component(source,destination,label):
    from pathlib import Path
    from types import SimpleNamespace
    from .safety import output_path
    args=SimpleNamespace(source=str(source),only=label)
    out=output_path(Path(destination));out.mkdir(parents=True,exist_ok=True)
    ds=discover(Path(source));lgp=ds.files['world_us.lgp']
    entries={e['filename'].casefold():e for e in inventory(lgp)['entries']}
    want_transitions=args.only in (None,'transitions')
    report={};sources={};records=[]
    if want_transitions:
        # Field destinations remain exact internal IDs.
        field_dir=child_ci(ds.wm_directory.parent,'field')
        field_archive=child_ci(field_dir,'flevel.lgp') if field_dir else None
        if not field_archive:raise ValueError('Field archive/maplist required for exact field identity')
        field_entry=next(e for e in inventory(field_archive)['entries'] if e['filename'].casefold()=='maplist')
        maplist=read_entry(field_archive,field_entry)
        table_data=read_entry(lgp,entries['field.tbl'])
        table=parse_field_table(table_data,parse_maplist(maplist))
        records=engine_links();sources={'field.tbl':hashlib.sha256(table_data).hexdigest(),'maplist':hashlib.sha256(maplist).hexdigest()}
    for map_id in (0,2,3):
        identity=f'WM{map_id}'
        if not want_transitions and args.only not in (identity,'textures-'+identity):continue
        world=parse_map(ds.files[identity.lower()+'.map'],map_id)
        if want_transitions:
            payload=read_entry(lgp,entries[identity.lower()+'.ev'])
            found,analysis=analyze_transitions(payload,world,table);records.extend(found)
            sources[identity.lower()+'.map']=hashlib.sha256(world.path.read_bytes()).hexdigest()
            sources[identity.lower()+'.ev']=hashlib.sha256(payload).hexdigest()
        if map_id and args.only in (None,identity):
            report[identity]=dict(map=export_native(world,out/f'gaia-map-{identity}.bin'))
        if map_id and args.only in (None,'textures-'+identity):
            # Recover the existing transport metadata without rewriting valid geometry.
            binary=out/f'gaia-map-{identity}.bin'
            import struct
            with binary.open('rb') as stream:
                prefix=stream.read(16);length=struct.unpack_from('<I',prefix,12)[0]
                if prefix[:8]!=b'GAIAMAP\0' or length>2_000_000:raise ValueError('Native metadata invalid')
                meta=json.loads(stream.read(length))
            meta.update(sha256=hashlib.sha256(binary.read_bytes()).hexdigest(),bytes=binary.stat().st_size)
            meta_path=out/f'gaia-map-{identity}.json'
            meta_path.write_text(json.dumps(meta,sort_keys=True,indent=2),encoding='utf8')
            textures=build_texture_pack(args.source,meta_path,out/f'gaia-textures-{identity}.bin',identity)
            report.setdefault(identity,dict(map=meta))['textures']=textures
    if want_transitions:
        sources['world_us.lgp']=hashlib.sha256(lgp.read_bytes()).hexdigest()
        transitions=dict(schema='gaiagis-map-transitions',version=1,sources=sources,transitions=sorted(records,key=lambda r:r['id']),
                         global_mapping={'WM2':None,'WM3':None},runtime_equivalence='NOT VERIFIED')
        (out/'gaia-transitions.json').write_text(json.dumps(transitions,sort_keys=True,indent=2),encoding='utf8')
    (out/'build-report.json').write_text(json.dumps(report,sort_keys=True,indent=2),encoding='utf8')
    return report
