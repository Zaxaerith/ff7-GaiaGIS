"""Local-only Explorer pack: validated original models and source walker data."""
# SPDX-License-Identifier: GPL-3.0-only
from collections import Counter,defaultdict
import hashlib,json,struct
from pathlib import Path
from .dataset import discover
from .lgp import inventory,read_entry
from .map_reader import parse_map
from .safety import output_path
from .tex import decode_tex
from .world_models import parse_hrc,parse_rsd,parse_p,parse_animation
from .ev import decode_ev

MAGIC=b'GAIAEXP\0'
SURFACE_BYTES=56
# Resource identity facts from classic-PC wmfile loader; animations remain indexed.
PRIMARY=(('cloud',0,'bbe',512),('tifa',1,'dlb',512),('cid',2,'ata',512),
         ('highwind',3,'cgd',768),('chocobo',19,'aja',512),
         ('tiny-bronco',5,'dva',640),('buggy',6,'aba',512),('submarine',13,'ddd',512))
# Independently recorded resource correspondence facts, not copied loader code.
MODEL_RESOURCES={0:['bbe'],1:['dlb'],2:['ata'],3:['cgd','cid'],4:['aja'],5:['dva'],6:['aba'],7:['aia'],8:['eke'],9:['dkc'],10:['bna'],11:['dyb'],12:['bkd'],13:['ddd'],14:['cfc'],15:['coc'],16:['cpc'],17:['cec'],18:['eje'],19:['aja'],20:['cmb'],21:['djc'],22:['djc'],23:['djc'],24:['aaa'],25:['cnb'],26:['ble'],27:['dic'],28:['dga'],29:['cqc'],30:['bud']}

def source_surface(world):
    """Edge slots are opposite corners. Same conservative policy as routing.

    WM0 identifies exact E/W endpoint XYZ only. Native maps never wrap.
    Duplicate faces and non-manifold/collapsed edges cannot be crossed.
    """
    width,_=world.extent;rows=[];edges=defaultdict(list);faces=defaultdict(list)
    for mesh in sorted(world.base_meshes,key=lambda m:(m.section_id,m.mesh_id)):
        for t in mesh.triangles:
            raw=[mesh.position(v) for v in t.indices];n=len(rows)
            points=[(x%width if world.map_id==0 else x,z,h) for x,z,h in raw]
            rows.append((raw,t.ff7_terrain_type,t.script,mesh.section_id,mesh.mesh_id,t.triangle_id))
            faces[tuple(sorted(points))].append(n)
            for slot,(a,b) in enumerate(((1,2),(2,0),(0,1))):edges[tuple(sorted((points[a],points[b])))].append((n,slot))
    duplicate={i for face in faces.values() if len(face)>1 for i in face};adj=[[-1]*3 for _ in rows];stats=Counter()
    for key,inc in edges.items():
        if key[0]==key[1]:stats['collapsed']+=1;continue
        if len(inc)!=2:stats['boundary' if len(inc)==1 else 'non_manifold']+=1;continue
        (a,sa),(b,sb)=inc
        if a==b or a in duplicate or b in duplicate:stats['ambiguous']+=1;continue
        adj[a][sa]=b;adj[b][sb]=a;stats['edges']+=1
    out=bytearray()
    for row,neighbors in zip(rows,adj):
        raw,terrain,script,section,mesh,triangle=row
        out.extend(struct.pack('<9i3iBB3H',*(v for p in raw for v in p),*neighbors,terrain,script,section,mesh,triangle))
    return bytes(out),dict(stats,triangles=len(rows),duplicate_faces=len(duplicate))

def build_explorer(source:Path,destination:Path,report_path:Path|None=None):
    destination=output_path(destination);ds=discover(source);archive=ds.files['world_us.lgp']
    entries={e['filename'].lower():e for e in inventory(archive)['entries']};hashes={};cache={}
    def read(name):
        if name not in entries:raise ValueError(f'Missing required Explorer resource: {name}')
        if name not in cache:cache[name]=read_entry(archive,entries[name]);hashes[name]=hashlib.sha256(cache[name]).hexdigest()
        return cache[name]
    hrcs=sorted(n for n in entries if n.endswith('.hrc'));anims=sorted(n for n in entries if n.endswith('.a'))
    payload=bytearray();models=[];surfaces=[];texture_refs={};inventory_rows=[]
    def blob(data):
        offset=len(payload);payload.extend(data)
        while len(payload)%4:payload.append(0)
        return dict(offset=offset,bytes=len(data))
    def floats(values):return blob(struct.pack('<'+'f'*len(values),*values))
    # Validate every resource, even those not shipped in the bounded primary pack.
    for name in hrcs:
        skeleton=parse_hrc(read(name));next_hrc=next((n for n in hrcs if n>name),'zzzz.hrc')
        clips=[n for n in anims if name<n<next_hrc];parts=[];textures=set();triangles=0
        for bone in skeleton['bones']:
            for ref in bone['resources']:
                rsd=parse_rsd(read(ref));mesh=parse_p(read(rsd['mesh']));triangles+=mesh['triangle_count'];parts.append(rsd['mesh']);textures.update(rsd['textures'])
                for g in mesh['groups']:
                    if g['texture'] is not None and g['texture']>=len(rsd['textures']):raise ValueError('P references nonexistent RSD texture')
        for n in clips:parse_animation(read(n),skeleton['bone_count'])
        for n in textures:decode_tex(read(n))
        primary=next((p for p in PRIMARY if p[2]+'.hrc'==name),None)
        texture_dimensions={n:[decode_tex(read(n)).width,decode_tex(read(n)).height] for n in sorted(textures)}
        inventory_rows.append(dict(resource=name,skeleton_name=skeleton['name'],bone_count=skeleton['bone_count'],part_count=len(parts),mesh_resources=parts,triangle_count=triangles,material_count=sum(len(parse_p(read(p))['groups']) for p in parts),texture_resources=sorted(textures),texture_dimensions=texture_dimensions,animation_resources=clips,animation_count=len(clips),identity=primary[0] if primary else skeleton['name'],identity_evidence='actual_hrc_and_classic_pc_loader' if primary else 'actual_hrc_name_only',model_ids=[mid for mid,resources in MODEL_RESOURCES.items() if Path(name).stem in resources]))
    for identity,model_id,stem,scale in PRIMARY:
        name=stem+'.hrc';skeleton=parse_hrc(read(name));row=next(r for r in inventory_rows if r['resource']==name);parts=[];clips=[]
        for bi,bone in enumerate(skeleton['bones']):
            for ref in bone['resources']:
                rsd=parse_rsd(read(ref));mesh=parse_p(read(rsd['mesh']))
                for g in mesh['groups']:
                    texture=None if g['texture'] is None else rsd['textures'][g['texture']]
                    if texture is not None and texture not in texture_refs:
                        tex=decode_tex(read(texture));texture_refs[texture]=dict(name=texture,width=tex.width,height=tex.height,**blob(tex.rgba))
                    values=[]
                    for vi in range(len(g['positions'])//3):values.extend(g['positions'][vi*3:vi*3+3]+g['normals'][vi*3:vi*3+3]+g['colors'][vi*4:vi*4+4]+g['uv'][vi*2:vi*2+2])
                    parts.append(dict(bone=bi,resource=rsd['mesh'],rsd=ref,group=g['group'],texture=texture,material=g['material'],vertices=len(values)//12,**floats(values)))
        for n in row['animation_resources']:
            clip=parse_animation(read(n),skeleton['bone_count']);values=clip.pop('values');clips.append(dict(name=n,**clip,**floats(values)))
        models.append(dict(id=identity,model_id=model_id,hrc=name,source_scale=max(scale/512,1)*15.2,bones=skeleton['bones'],bone_count=skeleton['bone_count'],parts=parts,clips=clips,identity_evidence='actual_hrc_and_classic_pc_reference',animation_identity='stationary_0_moving_1' if identity in ('cloud','tifa','cid','chocobo') else 'neutral_clip_indices'))
    for mid in (0,2,3):
        path=ds.files[f'wm{mid}.map'];hashes[f'wm{mid}.map']=hashlib.sha256(path.read_bytes()).hexdigest();world=parse_map(path,mid)
        if world.failures:raise ValueError('Incomplete source map')
        data,stats=source_surface(world);surfaces.append(dict(mapId=f'WM{mid}',extent=list(world.extent),source_sha256=hashes[f'wm{mid}.map'],record_bytes=SURFACE_BYTES,stats=stats,**blob(data)))
    model_references=defaultdict(list)
    for mid in (0,2,3):
        name=f'wm{mid}.ev';functions,_=decode_ev(read(name))
        for f in functions:
            if f.model is not None:model_references[f.model].append(dict(mapId=f'WM{mid}',source_file=name,call_table_record=f.table,function=f.id,instruction_start=f.start))
    model_inventory=[dict(model_id=mid,resources=[r+'.hrc' for r in MODEL_RESOURCES.get(mid,[])],resource_evidence='classic_pc_registry' if mid in MODEL_RESOURCES else 'unresolved_resource',known_script_references=model_references[mid],observed_map_usage=sorted({r['mapId'] for r in model_references[mid]}),identity='chocobo_related_resource_unresolved' if mid in (41,42) else 'unknown' if mid not in MODEL_RESOURCES else next(r['skeleton_name'] for r in inventory_rows if r['resource']==MODEL_RESOURCES[mid][0]+'.hrc')) for mid in range(43)]
    for row in inventory_rows:row['known_script_references']=[r for mid in row['model_ids'] for r in model_references[mid]]
    hashes['world_us.lgp']=hashlib.sha256(archive.read_bytes()).hexdigest()
    metadata=dict(schema='gaiagis-explorer',version=1,reconstruction='v1-geometric-gaia',runtimeClaim=False,sources=dict(sorted(hashes.items())),models=models,textures=[texture_refs[n] for n in sorted(texture_refs)],surfaces=surfaces,preview_timing_fps=30)
    encoded=json.dumps(metadata,sort_keys=True,separators=(',',':'),allow_nan=False).encode();padding=b'\0'*((-len(encoded))%4)
    body=MAGIC+struct.pack('<2I',1,len(encoded))+encoded+padding+payload;result=body+hashlib.sha256(body).digest()
    destination.parent.mkdir(parents=True,exist_ok=True);destination.write_bytes(result)
    report=dict(bytes=len(result),sha256=hashlib.sha256(result).hexdigest(),models=len(models),animations=sum(len(m['clips']) for m in models),inventory=inventory_rows,model_inventory=model_inventory,surface_stats={s['mapId']:s['stats'] for s in surfaces},sources=metadata['sources'],textures=len(texture_refs))
    if report_path:output_path(report_path).write_text(json.dumps(report,sort_keys=True,indent=2),encoding='utf8')
    return report
