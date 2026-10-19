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
