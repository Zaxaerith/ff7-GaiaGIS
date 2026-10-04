"""Exact-source WM0 adjacency and compact private routing transport."""
# SPDX-License-Identifier: GPL-3.0-only
from collections import Counter,defaultdict
import hashlib,json,math,struct
from pathlib import Path
from .dataset import discover
from .map_reader import parse_map
from .reconstruction import Mapping,SphereConfig
from .safety import output_path
from .traversal import evaluate,PROFILES

MAGIC=b'GAIARTG\0'
HEADER_BYTES=128
NODE_BYTES=16
ROUTE_PROFILES=tuple(p for p in PROFILES if p!='highwind-landing')

def route_state(profile,terrain,script=0):
    if profile not in ROUTE_PROFILES:raise ValueError('Not a routing movement profile')
    state=evaluate(profile,terrain,script)['state']
    return 'conditional' if state=='allowed' and terrain in (13,14,30) else state

def distance(a,b,radius=6371008.8):
    l,p=map(math.radians,a);m,q=map(math.radians,b)
    h=math.sin((q-p)/2)**2+math.cos(p)*math.cos(q)*math.sin((m-l)/2)**2
    return radius*2*math.asin(math.sqrt(min(1,max(0,h))))

def sphere_area(points,radius):
    vectors=[]
    for l,p in points:
        l,p=math.radians(l),math.radians(p);vectors.append((math.cos(p)*math.cos(l),math.cos(p)*math.sin(l),math.sin(p)))
    a,b,c=vectors;dot=lambda u,v:sum(x*y for x,y in zip(u,v))
    cross=(b[1]*c[2]-b[2]*c[1],b[2]*c[0]-b[0]*c[2],b[0]*c[1]-b[1]*c[0])
    return 2*abs(math.atan2(dot(a,cross),1+dot(a,b)+dot(b,c)+dot(c,a)))*radius**2

def build_graph(world):
    if world.map_id!=0 or world.failures:raise ValueError('Complete WM0 base source required')
    width,height=world.extent;mapping=Mapping(width,height,SphereConfig());nodes=[];faces=defaultdict(list);edges=defaultdict(list)
    for mesh in sorted(world.base_meshes,key=lambda m:(m.section_id,m.mesh_id)):
        for t in mesh.triangles:
            raw=[mesh.position(i) for i in t.indices];points=[(x%width,n,h) for x,n,h in raw];i=len(nodes)
            center=tuple(sum(p[j] for p in raw)/3 for j in range(3));lon,lat,_=mapping.game_to_geographic(*center)
            geographic=[mapping.game_to_geographic(*p)[:2] for p in raw]
            nodes.append(dict(section=mesh.section_id,mesh=mesh.mesh_id,triangle=t.triangle_id,terrain=t.ff7_terrain_type,script=t.script,area=sphere_area(geographic,6371008.8),center=(lon,lat)))
            faces[tuple(sorted(points))].append(i)
            for a,b in ((0,1),(1,2),(2,0)):
                key=tuple(sorted((points[a],points[b])));seam=raw[a][0]==raw[b][0] and raw[a][0] in (0,width)
                edges[key].append((i,seam,raw[a][0] if seam else None))
    duplicates={i for f in faces.values() if len(f)>1 for i in f};adj=[{} for _ in nodes];stats=Counter();seam_edges=0
    for key,inc in sorted(edges.items()):
        if key[0]==key[1]:stats['collapsed_edges']+=1;continue
        if len(inc)==1:stats['boundary_edges']+=1;continue
        if len(inc)>2:stats['non_manifold_edges']+=1;continue
        a,b=inc[0][0],inc[1][0]
        if a==b or a in duplicates or b in duplicates:stats['ambiguous_or_duplicate_edges']+=1;continue
        weight=distance(nodes[a]['center'],nodes[b]['center']);adj[a][b]=adj[b][a]=weight
        if inc[0][1] and inc[1][1] and inc[0][2]!=inc[1][2]:seam_edges+=1
    stats.update(nodes=len(nodes),edges=sum(map(len,adj))//2,seam_edges=seam_edges,duplicate_faces=len(duplicates),synthetic_nodes=0)
    return nodes,adj,dict(sorted(stats.items()))

def components(nodes,adj,profile,conditional=False):
    eligible=[route_state(profile,n['terrain'],n['script']) in (('allowed','conditional') if conditional else ('allowed',)) for n in nodes];labels=[-1]*len(nodes);rows=[]
    for i in range(len(nodes)):
        if not eligible[i] or labels[i]>=0:continue
        cid=len(rows);labels[i]=cid;stack=[i];count=0;area=0
        while stack:
            a=stack.pop();count+=1;area+=nodes[a]['area']
            for b in sorted(adj[a],reverse=True):
                if eligible[b] and labels[b]<0:labels[b]=cid;stack.append(b)
        rows.append(dict(id=cid,triangles=count,reference_area_m2=area))
    return labels,rows

def serialize_graph(nodes,adj,source_hash,seam_edges=0):
    """Versioned source-lineage CSR transport; no geographic coordinates."""
    n=len(nodes);arcs=sum(map(len,adj));offsets=[0];neighbors=[];weights=[]
    for row in adj:
        for b,w in sorted(row.items()):neighbors.append(b);weights.append(w)
        offsets.append(len(neighbors))
    node_offset=HEADER_BYTES;csr_offset=node_offset+n*NODE_BYTES;neighbor_offset=csr_offset+4*(n+1);weight_offset=neighbor_offset+4*arcs;total=weight_offset+8*arcs
    head=bytearray(HEADER_BYTES);head[:8]=MAGIC;struct.pack_into('<HH9I',head,8,1,HEADER_BYTES,n,arcs,node_offset,csr_offset,neighbor_offset,weight_offset,total,seam_edges,1);head[64:96]=bytes.fromhex(source_hash)
    out=bytearray(head)
    for node in nodes:out.extend(struct.pack('<HHHBBd',node['section'],node['mesh'],node['triangle'],node['terrain'],node['script'],node['area']))
    out.extend(struct.pack('<'+'I'*len(offsets),*offsets));out.extend(struct.pack('<'+'I'*arcs,*neighbors));out.extend(struct.pack('<'+'d'*arcs,*weights))
    return bytes(out)

def export_routing(source:Path,destination:Path):
    destination=output_path(destination);ds=discover(source)
    if destination.is_relative_to(ds.wm_directory.resolve()):raise ValueError('Output cannot be inside read-only source directory')
    nodes,adj,stats=build_graph(parse_map(ds.files['wm0.map'],0))
    out=serialize_graph(nodes,adj,hashlib.sha256(ds.files['wm0.map'].read_bytes()).hexdigest(),stats['seam_edges'])
    destination.parent.mkdir(parents=True,exist_ok=True);destination.write_bytes(out)
    stats['bytes']=len(out);stats['profiles']={p:{'components':len(components(nodes,adj,p)[1])} for p in ROUTE_PROFILES}
    return stats
