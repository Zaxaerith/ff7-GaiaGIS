# SPDX-License-Identifier: GPL-3.0-only
"""Exact source TIN diagnostics in independent (native X, native Z, raw Y).

No welding, modulo, repaired geometry, physical units or traversal semantics.
"""
from collections import Counter, defaultdict
from fractions import Fraction
from math import hypot


def _point(p):
    if len(p) != 3 or any(type(x) is not int or abs(x) > 1_000_000 for x in p):
        raise ValueError('Expected bounded integer native X/Z/raw-height')
    return tuple(p)


def distance_xz(p, q):
    p, q = _point(p), _point(q)
    return hypot(q[0]-p[0], q[1]-p[1])


def triangle_metrics(points):
    if len(points) != 3:
        raise ValueError('Expected three source corners')
    p, q, r = map(_point, points)
    u = tuple(q[i]-p[i] for i in range(3))
    v = tuple(r[i]-p[i] for i in range(3))
    cross = (u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0])
    d = cross[2]
    return dict(determinant=d, area=abs(d)/2, zero_xz=d == 0,
                degenerate_3d=cross == (0, 0, 0), cross_xzh=cross,
                a=None if not d else Fraction(-cross[0], d),
                b=None if not d else Fraction(-cross[1], d))


def analyze(points, terrains):
    """Edge incidence counts occurrences, including collapsed/repeated edges.

    Components join only noncollapsed keys with two occurrences on distinct faces.
    Duplicate excess is N-1; duplicate membership marks every member of the group.
    """
    if not 0 < len(points) <= 100_000 or len(points) != len(terrains):
        raise ValueError('Native face budget/terrain identity')
    faces = [tuple(map(_point, p)) for p in points]
    metrics = [triangle_metrics(p) for p in faces]
    edges, duplicates = defaultdict(list), defaultdict(list)
    for i, p in enumerate(faces):
        if type(terrains[i]) is not int or not 0 <= terrains[i] <= 31:
            raise ValueError('Native terrain code')
        duplicates[tuple(sorted(p))].append(i)
        for slot in range(3):
            edges[tuple(sorted((p[slot], p[(slot+1) % 3])))].append((i, slot))
    parent = list(range(len(faces)))
    def root(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    duplicate_sizes = [1]*len(faces)
    for group in duplicates.values():
        for i in group:
            duplicate_sizes[i] = len(group)
    incidence, collapsed, repeated = [[] for _ in faces], [0]*len(faces), [0]*len(faces)
    for (p, q), occurrences in edges.items():
        counts = Counter(i for i, _ in occurrences)
        for i, slot in occurrences:
            incidence[i].append((slot, len(occurrences)))
            collapsed[i] += p == q
            repeated[i] += counts[i] > 1
        if p != q and len(occurrences) == 2 and len(counts) == 2:
            a, b = (root(i) for i, _ in occurrences)
            parent[max(a, b)] = min(a, b)
    labels, groups = [], {}
    for i in range(len(faces)):
        r = root(i)
        if r not in groups:
            groups[r] = len(groups)
        labels.append(groups[r])
        metrics[i].update(edge_incidence=[n for _, n in sorted(incidence[i])],
                          collapsed_edges=collapsed[i], repeated_edges=repeated[i],
                          duplicate_count=duplicate_sizes[i], component=labels[i])
    terrain = {}
    for code in sorted(set(terrains)):
        subset = [m for m, t in zip(metrics, terrains) if t == code]
        terrain[code] = dict(faces=len(subset), nonzero=sum(not m['zero_xz'] for m in subset),
                             zero=sum(m['zero_xz'] for m in subset),
                             area=sum(abs(m['determinant']) for m in subset)/2)
    return dict(faces=metrics, edges=edges, terrain=terrain,
                summary=dict(faces=len(faces), zero_xz=sum(m['zero_xz'] for m in metrics),
                             degenerate_3d=sum(m['degenerate_3d'] for m in metrics),
                             duplicate_excess=sum(len(g)-1 for g in duplicates.values()),
                             edge_keys=len(edges), incidence_1=sum(len(o) == 1 for o in edges.values()),
                             incidence_2=sum(len(o) == 2 for o in edges.values()),
                             incidence_gt2=sum(len(o) > 2 for o in edges.values()),
                             collapsed_keys=sum(p == q for p, q in edges),
                             collapsed_occurrences=sum(len(o) for (p, q), o in edges.items() if p == q),
                             components=len(groups), largest_component=max(Counter(labels).values()),
                             area=sum(abs(m['determinant']) for m in metrics)/2))


def analyze_world(world):
    from .constants import LAYOUTS
    if world.map_id not in (2, 3) or world.failures or world.unknown_sections or world.section_count != LAYOUTS[world.map_id][0]*LAYOUTS[world.map_id][1] or len(world.base_meshes) != world.section_count*16:
        raise ValueError('Requires complete independent WM2/WM3 MAP')
    records = [(mesh, t) for mesh in world.base_meshes for t in mesh.triangles]
    return records, analyze([[mesh.position(i) for i in t.indices] for mesh, t in records],
                            [t.ff7_terrain_type for _, t in records])


def _xz(position):
    if len(position) != 2:
        raise ValueError('Expected native X/Z')
    q = tuple(Fraction(str(n)) for n in position)
    if any(abs(n) > 1_000_000 for n in q):
        raise ValueError('Native query range')
    return q


def _height_interval(points, position):
    """Intersect a vertical line with one source triangle, including degenerates."""
    values = []
    for a, b in zip(points, points[1:] + points[:1]):
        x, z = position
        if ((b[0]-a[0])*(z-a[1]) != (b[1]-a[1])*(x-a[0]) or
                not min(a[0], b[0]) <= x <= max(a[0], b[0]) or
                not min(a[1], b[1]) <= z <= max(a[1], b[1])):
            continue
        axis = 0 if a[0] != b[0] else 1
        if a[axis] == b[axis]:
            values.extend((Fraction(a[2]), Fraction(b[2])))
        else:
            t = (position[axis]-a[axis])/(b[axis]-a[axis])
            values.append(a[2]+t*(b[2]-a[2]))
    return (min(values), max(values)) if values else None


def query_surfaces(faces, position):
    """Exact independent oracle. Face ordinal retains every input occurrence.

    Callers retain their map/SHA/section/mesh/triangle identity alongside faces.
    Fractions/decimal strings are accepted; no tolerance, visibility or welding.
    """
    x, z = _xz(position)
    hits = []
    for i, points in enumerate(faces):
        p = tuple(map(_point, points))
        if not (min(v[0] for v in p) <= x <= max(v[0] for v in p) and
                min(v[1] for v in p) <= z <= max(v[1] for v in p)):
            continue
        m = triangle_metrics(p)
        if m['determinant']:
            # Solve the affine plane independently of the Web barycentric sum.
            signs = [(b[0]-a[0])*(z-a[1])-(b[1]-a[1])*(x-a[0])
                     for a, b in zip(p, p[1:]+p[:1])]
            if min(signs) < 0 < max(signs):
                continue
            h = p[0][2] + m['a']*(x-p[0][0]) + m['b']*(z-p[0][1])
            hits.append(dict(face=i, kind='surface', heights=(h, h)))
        else:
            h = _height_interval(p, (x, z))
            if h is not None:
                hits.append(dict(face=i, kind='degenerate' if m['degenerate_3d'] else 'vertical', heights=h))
    return hits


def transect_surfaces(faces, start, end):
    """Per-source Fraction segments/events/bands; never a fitted ground curve."""
    a, b = _xz(start), _xz(end)
    v = tuple(b[j]-a[j] for j in (0, 1))
    if v == (0, 0):
        raise ValueError('Zero-length native transect')
    cross = lambda u, w: u[0]*w[1]-u[1]*w[0]
    traces = []

    def clip(poly, bound, lower):
        out = []
        for p, q in zip(poly, poly[1:]+poly[:1]):
            inside = lambda r: r[0] >= bound if lower else r[0] <= bound
            pi, qi = inside(p), inside(q)
            if pi:
                out.append(p)
            if pi != qi:
                t = (bound-p[0])/(q[0]-p[0])
                out.append((bound, p[1]+t*(q[1]-p[1])))
        return out

    for i, points in enumerate(faces):
        p = tuple(map(_point, points))
        if any(max(a[j], b[j]) < min(q[j] for q in p) or
               min(a[j], b[j]) > max(q[j] for q in p) for j in (0, 1)):
            continue
        m = triangle_metrics(p)
        if m['determinant']:
            lo, hi = Fraction(0), Fraction(1)
            sign = 1 if m['determinant'] > 0 else -1
            for q, r in zip(p, p[1:]+p[:1]):
                w = (r[0]-q[0], r[1]-q[1])
                c = sign*cross(w, (a[0]-q[0], a[1]-q[1]))
                slope = sign*cross(w, v)
                if not slope:
                    if c < 0:
                        lo, hi = Fraction(1), Fraction(0)
                        break
                elif slope > 0:
                    lo = max(lo, -c/slope)
                else:
                    hi = min(hi, -c/slope)
            if lo <= hi:
                plane = lambda t: p[0][2]+m['a']*(a[0]+t*v[0]-p[0][0])+m['b']*(a[1]+t*v[1]-p[0][1])
                traces.append(dict(face=i, kind='touch' if lo == hi else 'surface', path=[(lo, plane(lo)), (hi, plane(hi))]))
        else:
            first, last = max(((q, r) for q in p for r in p),
                              key=lambda pair: sum((pair[1][j]-pair[0][j])**2 for j in (0, 1)))
            w = (last[0]-first[0], last[1]-first[1])
            delta = (first[0]-a[0], first[1]-a[1])
            den = cross(v, w)
            if den:
                t, s = cross(delta, w)/den, cross(delta, v)/den
                if 0 <= t <= 1 and 0 <= s <= 1:
                    h = _height_interval(p, tuple(a[j]+t*v[j] for j in (0, 1)))
                    if h is not None:
                        traces.append(dict(face=i, kind='degenerate_event' if m['degenerate_3d'] else 'vertical_event', path=[(t, h[0]), (t, h[1])]))
            elif cross(delta, v) == 0:
                axis = 0 if v[0] else 1
                poly = [((q[axis]-a[axis])/v[axis], Fraction(q[2])) for q in p]
                poly = clip(clip(poly, Fraction(0), True), Fraction(1), False)
                if poly:
                    traces.append(dict(face=i, kind='degenerate_band' if m['degenerate_3d'] else 'vertical_band', path=poly))
    return traces
