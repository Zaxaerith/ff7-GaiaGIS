#!/usr/bin/env python3
# ff7_wm_topology_probe.py
# Read-only topology probe for FF7 PC WM0.MAP.
# Standard library only. Does not modify game files.

from __future__ import annotations

import argparse
import hashlib
import json
import math
import struct
from collections import Counter
from pathlib import Path

SECTION_SIZE = 0xB800
MESH_SIZE = 8192
SECTIONS_X = 9
SECTIONS_Z = 7
BASE_SECTIONS = 63
MESH_COLS = SECTIONS_X * 4   # 36
MESH_ROWS = SECTIONS_Z * 4   # 28
WORLD_W = MESH_COLS * MESH_SIZE
WORLD_H = MESH_ROWS * MESH_SIZE

# Conservative "ocean-like" classes for exploratory seam search.
# Exact topology validation does not depend on these classifications.
OCEAN_TYPES = {3, 6, 26}  # Sea, Water, Sea (2)
WATERISH_TYPES = {3, 4, 5, 6, 11, 17, 18, 22, 26}

TERRAIN_NAMES = {
    0:"Grass",1:"Forest",2:"Mountain",3:"Sea",4:"River Crossing",5:"River",
    6:"Water",7:"Swamp",8:"Desert",9:"Wasteland",10:"Snow",11:"Riverside",
    12:"Cliff",13:"Corel Bridge",14:"Wutai Bridge",15:"Underwater Tunnel",
    16:"Hill Side",17:"Beach",18:"Sub Pen",19:"Canyon",20:"Mountain Pass",
    21:"Unknown (21)",22:"Waterfall",23:"Unused (23)",24:"Gold Saucer Desert",
    25:"Jungle",26:"Sea (2)",27:"Northern Cave",
    28:"Gold Saucer Desert Border",29:"Bridgehead",30:"Back Entrance",
    31:"Unused (31)"
}

def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest().upper()

def u16(b: bytes, o: int) -> int:
    return struct.unpack_from("<H", b, o)[0]

def u32(b: bytes, o: int) -> int:
    return struct.unpack_from("<I", b, o)[0]

def lzss_decompress(data: bytes) -> bytes:
    inpos = 0
    out = bytearray()
    while inpos < len(data):
        control = data[inpos]
        inpos += 1
        for bit in range(8):
            if inpos >= len(data):
                break
            if control & (1 << bit):
                out.append(data[inpos])
                inpos += 1
                continue
            if inpos + 1 >= len(data):
                raise ValueError("truncated LZSS reference")
            b0, b1 = data[inpos], data[inpos + 1]
            inpos += 2
            raw_offset = ((b1 & 0xF0) << 4) | b0
            length = (b1 & 0x0F) + 3
            pos = len(out) - ((len(out) - 18 - raw_offset) & 0x0FFF)
            chunk = bytearray()
            if pos < 0:
                zeros = min(-pos, length)
                chunk.extend(b"\x00" * zeros)
                pos += zeros
            remaining = length - len(chunk)
            if remaining:
                chunk.extend(out[pos:pos + remaining])
            out.extend(chunk)
            for i in range(len(chunk), length):
                out.append(0 if not chunk else chunk[i % len(chunk)])
    return bytes(out)

def parse_mesh(decoded: bytes):
    tri_count = u16(decoded, 0)
    vert_count = u16(decoded, 2)
    need = 4 + tri_count * 12 + vert_count * 16
    if len(decoded) < need:
        raise ValueError(f"decoded mesh too short: {len(decoded)} < {need}")

    pos = 4
    tris = []
    for _ in range(tri_count):
        v0, v1, v2, flags = struct.unpack_from("<BBBB", decoded, pos)
        ids = u16(decoded, pos + 10)
        tris.append({
            "v": (v0, v1, v2),
            "script": (flags >> 5) & 7,
            "terrain": flags & 31,
            "region": (ids >> 9) & 31,
            "texture": ids & 0x1FF,
            "chocobo": bool((ids >> 15) & 1),
        })
        pos += 12

    verts = []
    for _ in range(vert_count):
        verts.append(struct.unpack_from("<hhh", decoded, pos))
        pos += 8

    return tris, verts

def read_base_meshes(path: Path):
    raw = path.read_bytes()
    if len(raw) != 69 * SECTION_SIZE:
        raise ValueError(
            f"Expected WM0 size {69*SECTION_SIZE}, got {len(raw)} bytes"
        )

    result = []
    for section_idx in range(BASE_SECTIONS):
        sb = section_idx * SECTION_SIZE
        section_row = section_idx // SECTIONS_X
        section_col = section_idx % SECTIONS_X

        for mesh_idx in range(16):
            off = u32(raw, sb + mesh_idx * 4)
            mh = sb + off
            comp_size = u32(raw, mh)
            comp = raw[mh + 4: mh + 4 + comp_size]
            decoded = lzss_decompress(comp)
            tris, verts = parse_mesh(decoded)

            mesh_row = section_row * 4 + mesh_idx // 4
            mesh_col = section_col * 4 + mesh_idx % 4
            result.append({
                "section": section_idx,
                "mesh": mesh_idx,
                "row": mesh_row,
                "col": mesh_col,
                "triangles": tris,
                "vertices": verts,
            })
    return result

def global_vertex(mesh, idx):
    x, y, z = mesh["vertices"][idx]
    return (
        x + mesh["col"] * MESH_SIZE,   # game_east
        y,                             # game_height
        z + mesh["row"] * MESH_SIZE,   # game_north
    )

def seg_key(a, b, along_axis):
    # Preserve only coordinate along the world boundary and height.
    if along_axis == "north":
        p = (a[2], a[1])
        q = (b[2], b[1])
    else:
        p = (a[0], a[1])
        q = (b[0], b[1])
    return tuple(sorted((p, q)))

def boundary_segments(meshes):
    edges = {
        "west": Counter(),
        "east": Counter(),
        "north": Counter(),
        "south": Counter(),
    }

    for mesh in meshes:
        for tri in mesh["triangles"]:
            vv = tri["v"]
            if any(i >= len(mesh["vertices"]) for i in vv):
                continue
            gv = [global_vertex(mesh, i) for i in vv]
            for i, j in ((0, 1), (1, 2), (2, 0)):
                a, b = gv[i], gv[j]
                if a[0] == 0 and b[0] == 0:
                    edges["west"][seg_key(a, b, "north")] += 1
                if a[0] == WORLD_W and b[0] == WORLD_W:
                    edges["east"][seg_key(a, b, "north")] += 1
                if a[2] == 0 and b[2] == 0:
                    edges["north"][seg_key(a, b, "east")] += 1
                if a[2] == WORLD_H and b[2] == WORLD_H:
                    edges["south"][seg_key(a, b, "east")] += 1
    return edges

def compare_counters(a: Counter, b: Counter):
    keys = set(a) | set(b)
    matched = sum(min(a[k], b[k]) for k in keys)
    only_a = sum(max(0, a[k] - b[k]) for k in keys)
    only_b = sum(max(0, b[k] - a[k]) for k in keys)
    total_a = sum(a.values())
    total_b = sum(b.values())
    denom = max(total_a, total_b, 1)
    return {
        "segments_a": total_a,
        "segments_b": total_b,
        "matched_exactly": matched,
        "only_a": only_a,
        "only_b": only_b,
        "match_ratio": matched / denom,
    }

def mesh_cost_and_stats(mesh):
    counts = Counter(t["terrain"] for t in mesh["triangles"])
    n = sum(counts.values()) or 1
    ocean = sum(counts[t] for t in OCEAN_TYPES)
    waterish = sum(counts[t] for t in WATERISH_TYPES)
    land = n - waterish

    # A strong penalty for any non-waterish content, but a smaller penalty
    # for shallow/shore-related water classes. This is only an exploratory
    # mesh-scale seam cost, not a final triangle-level seam.
    cost = 0.0
    for tid, c in counts.items():
        if tid in OCEAN_TYPES:
            w = 0.0
        elif tid in WATERISH_TYPES:
            w = 5.0
        else:
            w = 100.0
        cost += w * c / n

    return {
        "triangles": n,
        "ocean_fraction": ocean / n,
        "waterish_fraction": waterish / n,
        "land_fraction": land / n,
        "cost": cost,
        "terrain_counts": dict(sorted(counts.items())),
    }

def best_straight_rows(grid):
    rows = []
    for r in range(MESH_ROWS):
        cells = [grid[r][c] for c in range(MESH_COLS)]
        tri = sum(x["triangles"] for x in cells)
        ocean = sum(x["ocean_fraction"] * x["triangles"] for x in cells)
        waterish = sum(x["waterish_fraction"] * x["triangles"] for x in cells)
        land = tri - waterish
        rows.append({
            "row": r,
            "triangle_count": tri,
            "ocean_fraction": ocean / tri if tri else 0,
            "waterish_fraction": waterish / tri if tri else 0,
            "land_fraction": land / tri if tri else 0,
            "mean_cost": sum(x["cost"] for x in cells) / MESH_COLS,
            "all_cells_pure_ocean": all(x["ocean_fraction"] == 1.0 for x in cells),
        })
    return sorted(rows, key=lambda x: (x["mean_cost"], x["land_fraction"]))

def best_monotone_wrapping_path(grid):
    # Search a left->right path across the 36 mesh columns.
    # Row may stay, move north, or move south by one cell per column,
    # with row wrap enabled. Endpoint row must equal start row so the
    # path closes when west/east borders are identified.
    best = None

    for start in range(MESH_ROWS):
        inf = float("inf")
        dp = [[inf] * MESH_ROWS for _ in range(MESH_COLS)]
        prev = [[None] * MESH_ROWS for _ in range(MESH_COLS)]
        dp[0][start] = grid[start][0]["cost"]

        for c in range(1, MESH_COLS):
            for r in range(MESH_ROWS):
                for pr in ((r - 1) % MESH_ROWS, r, (r + 1) % MESH_ROWS):
                    cand = dp[c - 1][pr] + grid[r][c]["cost"]
                    if cand < dp[c][r]:
                        dp[c][r] = cand
                        prev[c][r] = pr

        total = dp[MESH_COLS - 1][start]
        if not math.isfinite(total):
            continue

        path = [None] * MESH_COLS
        r = start
        for c in range(MESH_COLS - 1, -1, -1):
            path[c] = r
            if c > 0:
                r = prev[c][r]

        cells = [grid[path[c]][c] for c in range(MESH_COLS)]
        tri = sum(x["triangles"] for x in cells)
        ocean = sum(x["ocean_fraction"] * x["triangles"] for x in cells)
        waterish = sum(x["waterish_fraction"] * x["triangles"] for x in cells)
        land = tri - waterish

        candidate = {
            "total_cost": total,
            "start_end_row": start,
            "rows_by_column": path,
            "triangle_count_in_cells": tri,
            "ocean_fraction_weighted": ocean / tri if tri else 0,
            "waterish_fraction_weighted": waterish / tri if tri else 0,
            "land_fraction_weighted": land / tri if tri else 0,
            "pure_ocean_cells": sum(x["ocean_fraction"] == 1.0 for x in cells),
            "pure_waterish_cells": sum(x["waterish_fraction"] == 1.0 for x in cells),
        }

        if best is None or candidate["total_cost"] < best["total_cost"]:
            best = candidate

    return best

def main():
    ap = argparse.ArgumentParser(
        description="Read-only FF7 WM0 topology and ocean-seam probe."
    )
    ap.add_argument("directory", nargs="?", default=".",
                    help="Directory containing wm0.map")
    ap.add_argument("--json", default="ff7_wm_topology_probe.json")
    args = ap.parse_args()

    root = Path(args.directory).expanduser().resolve()
    path = root / "wm0.map"
    if not path.exists():
        raise SystemExit(f"Missing: {path}")

    print("Reading WM0.MAP (read-only)...")
    meshes = read_base_meshes(path)
    print(f"Parsed {len(meshes)} base meshes.")

    edges = boundary_segments(meshes)
    ew = compare_counters(edges["west"], edges["east"])
    ns = compare_counters(edges["north"], edges["south"])

    grid = [[None for _ in range(MESH_COLS)] for _ in range(MESH_ROWS)]
    mesh_rows = []
    for mesh in meshes:
        stats = mesh_cost_and_stats(mesh)
        grid[mesh["row"]][mesh["col"]] = stats
        mesh_rows.append({
            "row": mesh["row"],
            "col": mesh["col"],
            "section": mesh["section"],
            "mesh": mesh["mesh"],
            **stats,
        })

    straight = best_straight_rows(grid)
    wrapping = best_monotone_wrapping_path(grid)

    result = {
        "file": path.name,
        "sha256": sha256_file(path),
        "read_only": True,
        "world_raw_extent": [WORLD_W, WORLD_H],
        "base_mesh_grid": [MESH_COLS, MESH_ROWS],
        "base_meshes_parsed": len(meshes),
        "boundary_topology": {
            "west_vs_east": ew,
            "north_vs_south": ns,
            "interpretation": (
                "Exact segment matches compare boundary geometry after identifying "
                "opposite sides. A ratio of 1.0 means exact matching at this test level."
            ),
        },
        "straight_east_west_seam_candidates": straight[:10],
        "best_monotone_east_west_wrapping_mesh_path": wrapping,
        "mesh_stats": mesh_rows,
        "notes": [
            "The seam search is exploratory and operates at mesh-cell resolution.",
            "It does not yet certify that a triangle-level seam can avoid all land.",
            "OCEAN_TYPES = Sea, Water, Sea (2).",
            "WATERISH_TYPES additionally include river/shore/sub-pen/waterfall classes.",
        ],
    }

    out = root / args.json
    with out.open("w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print("\nBoundary topology:")
    print("  West ↔ East :", ew)
    print("  North ↔ South:", ns)

    print("\nBest straight east-west mesh rows:")
    for row in straight[:5]:
        print(
            f"  row {row['row']:2d}: cost={row['mean_cost']:.3f}, "
            f"ocean={row['ocean_fraction']:.3%}, "
            f"waterish={row['waterish_fraction']:.3%}, "
            f"land={row['land_fraction']:.3%}, "
            f"pure_ocean={row['all_cells_pure_ocean']}"
        )

    print("\nBest monotone wrapping mesh path:")
    print(f"  start/end row: {wrapping['start_end_row']}")
    print(f"  total cost:    {wrapping['total_cost']:.3f}")
    print(f"  ocean:         {wrapping['ocean_fraction_weighted']:.3%}")
    print(f"  waterish:      {wrapping['waterish_fraction_weighted']:.3%}")
    print(f"  land:          {wrapping['land_fraction_weighted']:.3%}")
    print(f"  pure ocean cells: {wrapping['pure_ocean_cells']}/{MESH_COLS}")
    print("  row path:", " ".join(map(str, wrapping["rows_by_column"])))

    print(f"\nJSON report written to: {out}")
    print("No FF7 files were modified.")

if __name__ == "__main__":
    main()
