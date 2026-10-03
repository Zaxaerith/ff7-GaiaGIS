"""Explicit synthetic caps; source triangles are neither welded nor repaired."""
from collections import Counter
from dataclasses import dataclass
from .analysis import boundary_edges
from .reconstruction import Mapping, unwrap_polygon

@dataclass
class Cap:
    hemisphere: str
    vertices: list
    triangles: list
    ring_indices: list
    topology_keys: list
    boundary_count: int
    boundary_source_refs: list

    def polygon(self, indices):
        points = [self.vertices[i] for i in indices]
        # A pole has no unique longitude. Use the sector midpoint in GIS;
        # Cartesian/GLB retains exactly one pole vertex.
        poles = [j for j,p in enumerate(points) if abs(p[1])==90]
        if poles:
            j = poles[0]
            pair = unwrap_polygon([p for k,p in enumerate(points) if k!=j])
            points[j] = (sum(p[0] for p in pair)/2, points[j][1], points[j][2])
        return points

def source_key(position, width):
    x,n,h = position
    return ("ff7",x%width,n,h)  # Longitude periodic, N/S deliberately NOT periodic.

def build_caps(world, mapping: Mapping):
    if not mapping.config.enabled:
        return []
    width,height = world.extent
    edges = boundary_edges(world.base_meshes,width,height)
    refs = {}
    for mesh in world.base_meshes:
        for i in range(len(mesh.vertices)):
            x,n,h = mesh.position(i)
            if n in (0,height):
                refs.setdefault((x%width,n,h),[]).append(dict(section_id=mesh.section_id,mesh_id=mesh.mesh_id,vertex_id=i))
    caps = []
    for side,n in (("low_north",0),("high_north",height)):
        segments = edges[side]
        samples = sorted({(x%width,h) for pair in segments for x,h in pair})
        if len({x for x,h in samples})!=len(samples) or len(samples)<3:
            raise ValueError(f"Ambiguous/non-simple polar boundary: {side}")
        expected = Counter(tuple(sorted((samples[i], (samples[(i+1)%len(samples)][0] if i+1<len(samples) else width,samples[(i+1)%len(samples)][1])))) for i in range(len(samples)))
        if set(expected)!=set(segments) or any(len(v)!=1 for v in segments.values()):
            raise ValueError(f"Polar boundary does not form a single closed longitude ring: {side}")
        boundary = [mapping.game_to_geographic(x,n,h) for x,h in samples]
        north = boundary[0][1]>0
        hemisphere = "north" if north else "south"
        sign = 1 if north else -1
        count = len(samples)
        vertices = list(boundary)
        rings = [0]*count
        keys = [source_key((x,n,h),width) for x,h in samples]
        source_refs = [refs[(x,n,h)] for x,h in samples]
        for ring in range(1,mapping.config.ring_count+1):
            fraction = ring/(mapping.config.ring_count+1)
            latitude = boundary[0][1]+fraction*(sign*90-boundary[0][1])
            for i,(lon,_,_) in enumerate(boundary):
                vertices.append((lon,latitude,0.0))
                rings.append(ring)
                keys.append(("cap",hemisphere,ring,i))
        pole = len(vertices)
        vertices.append((0.0,sign*90.0,0.0))
        rings.append(mapping.config.ring_count+1)
        keys.append(("pole",hemisphere))
        triangles = []
        for ring in range(mapping.config.ring_count):
            for i in range(count):
                j = (i+1)%count
                a,b = ring*count+i,ring*count+j
                c,d = (ring+1)*count+i,(ring+1)*count+j
                triangles.extend(((a,b,c),(b,d,c)))
        for i in range(count):
            triangles.append((mapping.config.ring_count*count+i,mapping.config.ring_count*count+(i+1)%count,pole))
        # Synthetic winding is outward. Source winding is never changed.
        outward = []
        for a,b,c in triangles:
            p,q,r = [mapping.geographic_to_cartesian(*vertices[i]) for i in (a,b,c)]
            u,v = [q[k]-p[k] for k in range(3)],[r[k]-p[k] for k in range(3)]
            normal = (u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])
            outward.append((a,b,c) if sum(normal[k]*p[k] for k in range(3))>=0 else (a,c,b))
        caps.append(Cap(hemisphere,vertices,outward,rings,keys,count,source_refs))
    return caps

def derived_topology(world, caps):
    width,_ = world.extent
    edges = Counter()
    source_faces = 0
    for mesh in world.base_meshes:
        for triangle in mesh.triangles:
            keys = [source_key(mesh.position(i),width) for i in triangle.indices]
            for a,b in ((0,1),(1,2),(2,0)):
                edges[tuple(sorted((keys[a],keys[b])))] += 1
            source_faces += 1
    cap_edge_keys = set()
    for cap in caps:
        for triangle in cap.triangles:
            keys = [cap.topology_keys[i] for i in triangle]
            for a,b in ((0,1),(1,2),(2,0)):
                key = tuple(sorted((keys[a],keys[b])))
                edges[key] += 1
                cap_edge_keys.add(key)
    return dict(diagnostic_only_position_identification=True,source_faces=source_faces,
                synthetic_faces=sum(len(c.triangles) for c in caps),
                longitude_periodic=True,north_south_identified=False,
                edge_incidence_histogram=dict(sorted(Counter(edges.values()).items())),
                open_edges=sum(v==1 for v in edges.values()),
                cap_or_attachment_open_edges=sum(edges[k]==1 for k in cap_edge_keys),
                cap_or_attachment_nonmanifold_edges=sum(edges[k]!=2 for k in cap_edge_keys),
                source_repairs_performed=0,
                note="Source overlaps and internal holes persist. Position keys identify seams ONLY for this diagnostic, not for exported source indices.")
