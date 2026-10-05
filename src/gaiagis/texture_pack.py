"""Deterministic optional WM texture pack; generated artwork stays local."""
# SPDX-License-Identifier: GPL-3.0-only
import hashlib
import json
from pathlib import Path
import struct
import zlib
from .dataset import discover
from .lgp import inventory, read_entry
from .map_reader import parse_map
from .tex import decode_tex

MAGIC = b'GAIATEX\0'
GUTTER = 4
UV_RECORD = struct.Struct('<4H6B')
# Classic-PC D_0096B448 correspondence, cross-checked against actual frame names.
ANIMATED_FRAME_COUNTS = dict(zip((264,275,265,276,67,257,129,236,196,56,205,235,188,57,206,234,253,58,208,53,61,192),
                                (8,8,8,8,8,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4)))

def catalog(map_id='WM0'):
    if map_id not in ('WM0','WM2','WM3'):
        raise ValueError('Unsupported map identity')
    records=[]
    filename='wm0_texture_catalog.tsv' if map_id=='WM0' else 'native_texture_catalog.tsv'
    for line in Path(__file__).with_name(filename).read_text(encoding='utf8').splitlines():
        if not line or line.startswith('#'):continue
        if map_id!='WM0':
            identity,line=line.split('\t',1)
            if identity!=map_id:continue
        i,name,w,h,u,v=line.split('\t')
        records.append(dict(id=int(i),name=name,width=int(w),height=int(h),u_offset=int(u),v_offset=int(v)))
    return records

def png_rgba(width,height,pixels):
    if len(pixels)!=width*height*4:raise ValueError('RGBA size mismatch')
    def chunk(kind,content):
        return struct.pack('>I',len(content))+kind+content+struct.pack('>I',zlib.crc32(kind+content)&0xffffffff)
    rows=b''.join(b'\0'+pixels[y*width*4:(y+1)*width*4] for y in range(height))
    return (b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>2I5B',width,height,8,6,0,0,0))+
            chunk(b'IDAT',zlib.compress(rows,9))+chunk(b'IEND',b''))

def atlas_layout(resources, padding=GUTTER):
    """Stable size/ID shelf packing; smallest square power-of-two fitting all."""
    for side in (256,512,1024,2048,4096):
        x=y=row_height=0; placements=[]
        for resource in sorted(resources,key=lambda r:(-r['height'],-r['width'],r['id'])):
            w,h=resource['width']+2*padding,resource['height']+2*padding
            if w>side or h>side:break
            if x+w>side:x=0;y+=row_height;row_height=0
            if y+h>side:break
            placements.append(dict(resource,x=x+padding,y=y+padding));x+=w;row_height=max(row_height,h)
        else:return side,placements
    raise ValueError('Atlas exceeds supported size')

def build_atlas(resources,images):
    side,placements=atlas_layout(resources);pixels=bytearray(side*side*4)
    for r in placements:
        image=images[r['id']];w,h=r['width'],r['height']
        for dy in range(-GUTTER,h+GUTTER):
            sy=max(0,min(h-1,dy))
            for dx in range(-GUTTER,w+GUTTER):
                sx=max(0,min(w-1,dx));a=((r['y']+dy)*side+r['x']+dx)*4;b=(sy*w+sx)*4
                pixels[a:a+4]=image.rgba[b:b+4]
    return side,placements,bytes(pixels)

def build_texture_pack(source_root,meta_path,output_path,map_id='WM0'):
    workspace=Path(__file__).resolve().parents[2]
    output_path=Path(output_path).resolve()
    if not output_path.is_relative_to(workspace):raise ValueError('Output must remain in GaiaGIS workspace')
    ds=discover(Path(source_root));lgp=ds.files['world_us.lgp'];entries={e['filename'].casefold():e for e in inventory(lgp)['entries']}
    if map_id not in ('WM0','WM2','WM3'):raise ValueError('Unsupported map identity')
    source_map=map_id.lower()+'.map'
    world=parse_map(ds.files[source_map],int(map_id[2]))
    if world.failures:raise ValueError('WM0 parse failures prevent UV export')
    definitions=catalog(map_id);images={};missing=[]
    for r in definitions:
        e=entries.get(r['name']+'.tex')
        if not e:missing.append(dict(id=r['id'],reason='missing resource'));continue
        try:
            payload=read_entry(lgp,e);image=decode_tex(payload)
            if (image.width,image.height)!=(r['width'],r['height']):raise ValueError('catalog/source dimension mismatch')
            images[r['id']]=image;r.update(source_sha256=hashlib.sha256(payload).hexdigest(),rgba_sha256=hashlib.sha256(image.rgba).hexdigest(),format=image.metadata,has_alpha=any(a<255 for a in image.rgba[3::4]))
            if map_id=='WM0' and r['id'] in ANIMATED_FRAME_COUNTS:
                r['frame_count']=ANIMATED_FRAME_COUNTS[r['id']]
                r['frames']=[r['name'][:-1]+str(i)+'.tex' for i in range(1,r['frame_count']+1)]
                r['missing_frames']=[name for name in r['frames'] if name not in entries]
        except (ValueError,RuntimeError) as exc:missing.append(dict(id=r['id'],reason=str(exc)))
    side,table,pixels=build_atlas([r for r in definitions if r['id'] in images],images)
    uv=bytearray()
    for mesh in world.base_meshes:
        for tri in mesh.triangles:
            uv.extend(UV_RECORD.pack(mesh.section_id,mesh.mesh_id,tri.triangle_id,tri.texture,*[n for pair in tri.uv for n in pair]))
    image=png_rgba(side,side,pixels);meta=json.loads(Path(meta_path).read_text(encoding='utf8'))
    header=dict(schema='gaiagis-textures',version=1,mapId=map_id,reconstruction='V1 Geometric Gaia' if map_id=='WM0' else map_id+'Native',
        mesh_sha256=meta['sha256'],sources={name:hashlib.sha256(ds.files[name].read_bytes()).hexdigest() for name in (source_map,'world_us.lgp')},
        atlas=dict(width=side,height=side,padding=GUTTER,encoding='png',color_space='srgb',mipmaps=False),
        textures=table,missing=missing,triangle_count=len(uv)//UV_RECORD.size,uv_record_bytes=UV_RECORD.size,
        uv_byte_length=len(uv),image_byte_length=len(image),payload_sha256=hashlib.sha256(uv+image).hexdigest(),
        sampler='signed-page-relative-repeat',static_frame=1)
    encoded=json.dumps(header,sort_keys=True,separators=(',',':'),ensure_ascii=True).encode('ascii')
    body=MAGIC+struct.pack('<2I',1,len(encoded))+encoded+uv+image
    pack=body+hashlib.sha256(body).digest()  # protects metadata as well as payload
    output_path.parent.mkdir(parents=True,exist_ok=True);output_path.write_bytes(pack)
    return dict(byte_length=len(pack),sha256=hashlib.sha256(pack).hexdigest(),atlas_side=side,
                decoded_pixel_bytes=len(pixels),uv_byte_length=len(uv),resources=len(table),missing=missing)
