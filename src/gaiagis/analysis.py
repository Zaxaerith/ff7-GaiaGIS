"""Validation probes in raw game units. These are not GIS products."""
from collections import Counter, defaultdict
import math
from .constants import LAYOUTS, ALTERNATIVES, MESH_UNITS, OCEAN_TYPES, REGION_NAMES, TERRAIN_NAMES

def area_centroid(points):
    a, b, c = points
    area = abs((b[0]-a[0])*(c[1]-a[1]) - (c[0]-a[0])*(b[1]-a[1])) / 2
    return area, tuple(sum(p[i] for p in points)/3 for i in range(3))

def circular_mean(samples, period):
    total = sum(weight for _, weight in samples)
    if total <= 0:
        return None, 0.0
    sine = sum(weight * math.sin(math.tau * value / period) for value, weight in samples)
    cosine = sum(weight * math.cos(math.tau * value / period) for value, weight in samples)
    concentration = math.hypot(sine, cosine) / total
    if concentration < 1e-12:
        return None, concentration
    value = (math.atan2(sine, cosine) % math.tau) * period / math.tau
    return (0.0 if abs(value-period) < 1e-8 else value), concentration

def circular_span(intervals, period):
    """Complement of largest uncovered gap in triangle projected support.

    Intervals (not just vertices) correctly identify full-circle ocean support.
    Return arc start, end, length, whether the minimal arc wraps coordinate zero.
    """
    merged = []
    for lo, hi in sorted(intervals):
        if merged and lo <= merged[-1][1]:
            merged[-1][1] = max(hi, merged[-1][1])
        else:
            merged.append([lo, hi])
    if not merged:
        return None, None, None, False
    gaps = [(b[0]-a[1], b[0], a[1]) for a, b in zip(merged, merged[1:])]
    gaps.append((merged[0][0] + period-merged[-1][1], merged[0][0], merged[-1][1]))
    gap, start, end = max(gaps)
    length = period - gap
    return start % period, end % period, length, start > end if gap > 0 else False

def spatial_stats(items, width, height, key, names):
    grouped = defaultdict(list)
    for mesh, triangle, points, area, centroid in items:
        grouped[getattr(triangle, key)].append((mesh, triangle, points, area, centroid))
    rows = []
    for identity, group in sorted(grouped.items()):
        weight = sum(g[3] for g in group)
        record = dict(id=identity, name=names.get(identity, f"Unknown {identity}"),
                      triangle_count=len(group), horizontal_area_raw2=weight,
                      zero_horizontal_area_triangles=sum(g[3] == 0 for g in group))
        for axis, period in enumerate((width, height)):
            label = "x" if axis == 0 else "y"
            samples = [(g[4][axis], g[3]) for g in group]
            mean, concentration = circular_mean(samples, period)
            linear = sum(v*w for v, w in samples)/weight if weight else None
            coords = [p[axis] for g in group for p in g[2]]
            intervals = [(min(p[axis] for p in g[2]), max(p[axis] for p in g[2])) for g in group]
            start, end, span, wraps = circular_span(intervals, period)
            record.update({f"linear_{label}": linear, f"circular_{label}": mean,
                           f"resultant_{label}": concentration,
                           f"vertex_bbox_{label}_min": min(coords), f"vertex_bbox_{label}_max": max(coords),
                           f"triangle_centroid_bbox_{label}_min": min(v for v, _ in samples),
                           f"triangle_centroid_bbox_{label}_max": max(v for v, _ in samples),
                           f"arc_{label}_start": start, f"arc_{label}_end": end,
                           f"circular_span_{label}": span, f"minimal_arc_wraps_{label}": wraps,
                           f"touches_both_periodic_{label}_edges": min(coords) == 0 and max(coords) == period,
                           f"crosses_periodic_{label}_seam": min(coords) == 0 and max(coords) == period,
                           f"linear_circular_delta_{label}": abs((linear-mean+period/2)%period-period/2) if mean is not None else None})
        hs = [p[2] for g in group for p in g[2]]
        record.update(game_height_min=min(hs), game_height_max=max(hs))
        rows.append(record)
    return rows

def geometry_summary(world):
    base = world.base_meshes
    all_positions = [m.position(i) for m in base for i in range(len(m.vertices))]
    normals = [n for m in base for n in m.normals]
    lengths = [math.sqrt(n.raw_x**2+n.raw_y**2+n.raw_z**2) for n in normals]
    triangles = [t for m in base for t in m.triangles]
    points = [([m.position(i) for i in t.indices], m, t) for m in base for t in m.triangles]
    areas = [area_centroid(ps)[0] for ps, _, _ in points]
    nx, ny = LAYOUTS[world.map_id]
    total = world.section_count * 16
    decoded = len(world.meshes)
    result = dict(map_id=world.map_id, source_file=str(world.path), section_size=0xB800,
                  sections=world.section_count, section_grid_profile=[nx, ny],
                  mesh_grid_profile=[nx*4, ny*4], base_sections_profile=nx*ny,
                  meshes_total=decoded, meshes_attempted=total, base_meshes=len(base),
                  triangles_base=len(triangles), vertex_records_base=len(all_positions),
                  triangles_all=sum(len(m.triangles) for m in world.meshes),
                  vertex_records_all=sum(len(m.vertices) for m in world.meshes),
                  mesh_failures=world.failures, failed_meshes=total-decoded,
                  invalid_vertex_references=sum("vertex reference" in f["error"] for f in world.failures),
                  decoded_trailing_bytes=0 if not world.failures else None,
                  unknown_sections=world.unknown_sections,
                  profile_count_matches=world.section_count == nx*ny+(6 if world.map_id == 0 else 0),
                  extent={label: [min(p[i] for p in all_positions), max(p[i] for p in all_positions)]
                          for i, label in enumerate(("game_east", "game_north", "game_height"))},
                  terrain_counts=dict(Counter(t.ff7_terrain_type for t in triangles)),
                  region_counts=dict(Counter(t.region for t in triangles)),
                  script_counts=dict(Counter(t.script for t in triangles)),
                  texture_counts=dict(Counter(t.texture for t in triangles)),
                  unknown_bit14_count=sum(t.unknown_bit14 for t in triangles),
                  chocobo_triangles=sum(t.is_chocobo for t in triangles),
                  horizontal_area_sum_raw2=sum(areas), expected_rectangle_area_raw2=math.prod(world.extent),
                  zero_horizontal_area_triangles=sum(a == 0 for a in areas),
                  normal_length=dict(min=min(lengths), max=max(lengths), mean=sum(lengths)/len(lengths),
                                     zero_count=sum(v == 0 for v in lengths)),
                  normal_padding_nonzero=sum(n.padding != 0 for n in normals))
    alignment = Counter()
    for ps, mesh, t in points:
        # Cross product in semantic (east,north,height); remap raw normal likewise.
        u = tuple(ps[1][i]-ps[0][i] for i in range(3))
        v = tuple(ps[2][i]-ps[0][i] for i in range(3))
        cross = (u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0])
        clen = math.sqrt(sum(x*x for x in cross))
        for index in t.indices:
            n = mesh.normals[index]
            normal = (n.raw_x, n.raw_z, n.raw_y)
            nlen = math.sqrt(sum(x*x for x in normal))
            if clen == 0 or nlen == 0:
                alignment["undefined"] += 1
            else:
                cosine = sum(a*b for a,b in zip(cross,normal))/(clen*nlen)
                alignment["same_hemisphere" if cosine > 0 else "opposite_or_orthogonal"] += 1
                alignment["abs_cosine_below_0.5"] += abs(cosine) < 0.5
    result["normal_face_alignment_corners"] = dict(alignment)
    return result

def boundary_edges(meshes, width, height):
    edges = {s: defaultdict(list) for s in ("west", "east", "low_north", "high_north")}
    for mesh in meshes:
        for t in mesh.triangles:
            positions = [mesh.position(i) for i in t.indices]
            for a,b in ((0,1),(1,2),(2,0)):
                for side, axis, value in (("west",0,0),("east",0,width),
                                          ("low_north",1,0),("high_north",1,height)):
                    if positions[a][axis] != value or positions[b][axis] != value:
                        continue
                    other = 1-axis
                    ordered = sorted((a,b), key=lambda i:(positions[i][other],positions[i][2]))
                    key = tuple((positions[i][other],positions[i][2]) for i in ordered)
                    normals = tuple((mesh.normals[t.indices[i]].raw_x,
                                     mesh.normals[t.indices[i]].raw_y,
                                     mesh.normals[t.indices[i]].raw_z) for i in ordered)
                    edges[side][key].append(dict(terrain=t.ff7_terrain_type, region=t.region, script=t.script,
                                                  texture=t.texture, uv=tuple(t.uv[i] for i in ordered),
                                                  normals=normals, chocobo=t.is_chocobo,
                                                  lineage=mesh.lineage(t)))
    return edges

def compare_boundaries(a, b):
    ca, cb = Counter({k:len(v) for k,v in a.items()}), Counter({k:len(v) for k,v in b.items()})
    shared = ca & cb
    matched = sum(shared.values())
    checks = Counter()
    deltas = Counter()
    examples = []
    ambiguous = 0
    texture_pairs = Counter()
    for key, count in shared.items():
        if count != 1 or len(a[key]) != 1 or len(b[key]) != 1:
            ambiguous += count
            continue
        left, right = a[key][0], b[key][0]
        texture_pairs[(left["texture"],right["texture"])] += 1
        mismatch = []
        for attr in ("terrain", "region", "script", "texture", "uv", "normals", "chocobo"):
            checks[attr+"_equal"] += left[attr] == right[attr]
            if left[attr] != right[attr]: mismatch.append(attr)
        for luv, ruv in zip(left["uv"],right["uv"]):
            deltas[(ruv[0]-luv[0],ruv[1]-luv[1])] += 1
        if mismatch and len(examples) < 12:
            examples.append(dict(segment=key, differing_attributes=mismatch, side_a=left, side_b=right))
    # Height is part of the exact key; horizontal-only matching is checked separately.
    ha = Counter()
    hb = Counter()
    for source, target in ((a,ha),(b,hb)):
        for key, records in source.items(): target[tuple(v[0] for v in key)] += len(records)
    return dict(segments_a=sum(ca.values()), segments_b=sum(cb.values()),
                horizontal_position_matches=sum((ha & hb).values()),
                exact_position_and_height_matches=matched,
                match_ratio=matched/max(sum(ca.values()),sum(cb.values())) if ca or cb else None,
                unmatched_a=sum((ca-cb).values()), unmatched_b=sum((cb-ca).values()),
                attribute_comparable_segments=matched-ambiguous, ambiguous_segments=ambiguous,
                attributes=dict(checks), texture_pairs={str(k):v for k,v in texture_pairs.items()},
                uv_endpoint_deltas={str(k):v for k,v in deltas.items()}, mismatch_examples=examples)

def topology(world):
    width,height = world.extent
    boundaries = boundary_edges(world.base_meshes,width,height)
    result = dict(west_east=compare_boundaries(boundaries["west"],boundaries["east"]),
                  low_high_north=compare_boundaries(boundaries["low_north"],boundaries["high_north"]))
    edge_incidence = Counter()
    vertices = set()
    internal = defaultdict(Counter)
    degenerates = []
    for mesh in world.base_meshes:
        for t in mesh.triangles:
            ps = [mesh.position(i) for i in t.indices]
            welded = [(x%width,y%height,h) for x,y,h in ps]
            vertices.update(welded)
            if area_centroid(ps)[0] == 0 and len(degenerates) < 20:
                degenerates.append(dict(**mesh.lineage(t),positions=ps))
            for a,b in ((0,1),(1,2),(2,0)):
                edge_incidence[tuple(sorted((welded[a],welded[b])))] += 1
                for axis in (0,1):
                    val = ps[a][axis]
                    if val == ps[b][axis] and val % MESH_UNITS == 0 and 0 < val < (width if axis == 0 else height):
                        # Mesh ownership distinguished by cell; geometry keys include height.
                        internal[(axis,val,tuple(sorted((ps[a],ps[b]))))][mesh.cell] += 1
    internal_bad = [dict(axis=k[0],coordinate=k[1],segment=k[2],mesh_cells={str(c):n for c,n in owners.items()})
                    for k,owners in internal.items() if len(owners) != 2 or sorted(owners.values()) != [1,1]]
    faces = sum(len(m.triangles) for m in world.base_meshes)
    result["position_weld_diagnostic"] = dict(used_position_keys=len(vertices), edges=len(edge_incidence), faces=faces,
        euler_characteristic=len(vertices)-len(edge_incidence)+faces,
        edge_incidence_histogram=dict(Counter(edge_incidence.values())),
        warning="Exact position weld is diagnostic, not final topological deduplication; degenerate/overlapping faces retained.")
    suspect = {edge for edge,n in edge_incidence.items() if n!=2}
    owners = defaultdict(list)
    face_counts = Counter()
    normal_examples = []
    for mesh in world.base_meshes:
        for t in mesh.triangles:
            ps = [mesh.position(i) for i in t.indices]
            welded = [(x%width,y%height,h) for x,y,h in ps]
            face_counts[tuple(sorted(welded))] += 1
            for a,b in ((0,1),(1,2),(2,0)):
                edge=tuple(sorted((welded[a],welded[b])))
                if edge in suspect: owners[edge].append(mesh.lineage(t))
        for i,n in enumerate(mesh.normals):
            length=math.sqrt(n.raw_x**2+n.raw_y**2+n.raw_z**2)
            if length<4000 and len(normal_examples)<20:
                normal_examples.append(dict(source_file=mesh.source_file,section_id=mesh.section_id,
                                            mesh_id=mesh.mesh_id,vertex_index=i,
                                            raw_normal=[n.raw_x,n.raw_y,n.raw_z],length=length))
    result["position_weld_diagnostic"]["duplicate_face_excess"] = sum(n-1 for n in face_counts.values() if n>1)
    result["position_weld_diagnostic"]["abnormal_edge_records"] = [dict(segment=edge,incidence=edge_incidence[edge],lineage=owners[edge]) for edge in sorted(suspect)]
    result["short_normal_examples"] = normal_examples
    result["internal_mesh_seams"] = dict(segment_keys=len(internal), problematic_segment_keys=len(internal_bad),examples=internal_bad[:20])
    result["zero_horizontal_area_examples"] = degenerates
    rows = []
    grid = []
    for mesh in world.base_meshes:
        col,row = mesh.cell
        counts = Counter(t.ff7_terrain_type for t in mesh.triangles)
        ocean = sum(counts[t] for t in OCEAN_TYPES)
        grid.append(dict(section_id=mesh.section_id,mesh_id=mesh.mesh_id,col=col,row=row,
                         triangles=len(mesh.triangles),ocean_triangles=ocean,
                         pure_ocean=ocean==len(mesh.triangles),
                         non_ocean_triangles=len(mesh.triangles)-ocean))
    for row in (0,LAYOUTS[world.map_id][1]*4-1):
        meshes = [m for m in world.base_meshes if m.cell[1] == row]
        ts = [t for m in meshes for t in m.triangles]
        hs = [v.raw_y for m in meshes for v in m.vertices]
        rows.append(dict(row=row,meshes=len(meshes),pure_ocean_meshes=sum(all(t.ff7_terrain_type in OCEAN_TYPES for t in m.triangles) for m in meshes),
                         triangles=len(ts),non_ocean_triangles=sum(t.ff7_terrain_type not in OCEAN_TYPES for t in ts),
                         terrain_counts=dict(Counter(t.ff7_terrain_type for t in ts)),
                         region_counts=dict(Counter(t.region for t in ts)),script_counts=dict(Counter(t.script for t in ts)),
                         script_trigger_triangles=sum(t.script>=3 for t in ts),
                         chocobo_triangles=sum(t.is_chocobo for t in ts),height_range=[min(hs),max(hs)]))
    result["cut_rows"] = rows
    alternatives = []
    for s,target in ALTERNATIVES.items():
        alt = [m for m in world.meshes if m.section_id==s]
        base = [m for m in world.base_meshes if m.section_id==target]
        def perimeter(ms):
            keys = Counter()
            for m in ms:
                for t in m.triangles:
                    ps = [m.position(i) for i in t.indices]
                    for a,b in ((0,1),(1,2),(2,0)): keys[tuple(sorted((ps[a],ps[b])))] += 1
            return Counter({k:v for k,v in keys.items() if v==1})
        pa,pb = perimeter(alt),perimeter(base)
        alternatives.append(dict(alternative_section=s,replaces_base_section=target,meshes=len(alt),
                                 base_perimeter_segments=sum(pb.values()),alt_perimeter_segments=sum(pa.values()),
                                 perimeter_exact_matches=sum((pa&pb).values()),
                                 mapping_status="External engine/editor mapping; applied and perimeter checked, not encoded by MAP"))
    result["alternative_sections"] = alternatives
    groups=[]
    for members,targets in (((63,),(50,)),((64,65),(41,42)),((66,),(60,)),((67,68),(47,48))):
        pa=perimeter([m for m in world.meshes if m.section_id in members])
        pb=perimeter([m for m in world.base_meshes if m.section_id in targets])
        groups.append(dict(alternative_sections=members,base_sections=targets,
                           alternative_perimeter_segments=sum(pa.values()),base_perimeter_segments=sum(pb.values()),
                           exact_matches=sum((pa&pb).values()),unmatched_alternative=sum((pa-pb).values()),
                           unmatched_base=sum((pb-pa).values())))
    result["alternative_group_perimeters"] = groups
    return result,grid

def geography(world):
    items=[]
    for m in world.base_meshes:
        for t in m.triangles:
            ps=[m.position(i) for i in t.indices]
            area,centroid=area_centroid(ps)
            items.append((m,t,ps,area,centroid))
    return (spatial_stats(items,*world.extent,"region",REGION_NAMES),
            spatial_stats(items,*world.extent,"ff7_terrain_type",TERRAIN_NAMES))
