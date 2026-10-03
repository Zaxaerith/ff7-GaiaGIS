#!/usr/bin/env python3
# ff7_wm_validate.py
# Read-only validator for classic/2026 PC Final Fantasy VII world-map MAP files.
# No third-party packages required.

from __future__ import annotations

import argparse
import hashlib
import json
import struct
from collections import Counter
from pathlib import Path
from typing import Dict, List, Tuple

SECTION_SIZE = 0xB800
MESHES_PER_SECTION = 16
MESHES_PER_SIDE = 4
MESH_SIZE = 8192

MAP_CONFIG = {
    "wm0.map": {"name": "Overworld", "sections_x": 9, "sections_z": 7, "base_sections": 63},
    "wm2.map": {"name": "Underwater", "sections_x": 3, "sections_z": 4, "base_sections": 12},
    "wm3.map": {"name": "Great Glacier", "sections_x": 2, "sections_z": 2, "base_sections": 4},
}

# For WM0, sections 63..68 are alternate versions of these base sections.
WM0_ALTERNATIVE_BASE_SECTIONS = [50, 41, 42, 60, 47, 48]

REGION_NAMES = {
    0: "Midgar Area",
    1: "Grasslands Area",
    2: "Junon Area",
    3: "Corel Area",
    4: "Gold Saucer Area",
    5: "Gongaga Area",
    6: "Cosmo Area",
    7: "Nibel Area",
    8: "Rocket Launch Pad Area",
    9: "Wutai Area",
    10: "Woodlands Area",
    11: "Icicle Area",
    12: "Mideel Area",
    13: "North Corel Area",
    14: "Cactus Island",
    15: "Goblin Island",
    16: "Round Island",
    17: "Sea",
    18: "Bottom of the Sea",
    19: "Glacier",
}

TERRAIN_NAMES = {
    0: "Grass",
    1: "Forest",
    2: "Mountain",
    3: "Sea",
    4: "River Crossing",
    5: "River",
    6: "Water",
    7: "Swamp",
    8: "Desert",
    9: "Wasteland",
    10: "Snow",
    11: "Riverside",
    12: "Cliff",
    13: "Corel Bridge",
    14: "Wutai Bridge",
    15: "Underwater Tunnel",
    16: "Hill Side",
    17: "Beach",
    18: "Sub Pen",
    19: "Canyon",
    20: "Mountain Pass",
    21: "Unknown (21)",
    22: "Waterfall",
    23: "Unused (23)",
    24: "Gold Saucer Desert",
    25: "Jungle",
    26: "Sea (2)",
    27: "Northern Cave",
    28: "Gold Saucer Desert Border",
    29: "Bridgehead",
    30: "Back Entrance",
    31: "Unused (31)",
}


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest().upper()


def u16(data: bytes, off: int) -> int:
    return struct.unpack_from("<H", data, off)[0]


def i16(data: bytes, off: int) -> int:
    return struct.unpack_from("<h", data, off)[0]


def u32(data: bytes, off: int) -> int:
    return struct.unpack_from("<I", data, off)[0]


def ff7_lzss_decompress(data: bytes) -> bytes:
    """
    Matches the LZSS decoder used by ff7-landscaper:
      window 0x1000, min ref len 3, max ref len 18, LSB-first control bits.
    """
    MIN_REF_LEN = 3
    MAX_REF_LEN = 18
    WINDOW_MASK = 0x0FFF

    inpos = 0
    out = bytearray()

    while inpos < len(data):
        control = data[inpos]
        inpos += 1

        for bit in range(8):
            if inpos >= len(data):
                break

            literal = bool(control & (1 << bit))
            if literal:
                out.append(data[inpos])
                inpos += 1
                continue

            if inpos + 1 >= len(data):
                raise ValueError("Truncated LZSS reference")

            b0 = data[inpos]
            b1 = data[inpos + 1]
            inpos += 2

            raw_offset = ((b1 & 0xF0) << 4) | b0
            length = (b1 & 0x0F) + MIN_REF_LEN
            pos = len(out) - ((len(out) - MAX_REF_LEN - raw_offset) & WINDOW_MASK)

            chunk = bytearray()
            if pos < 0:
                zero_count = min(-pos, length)
                chunk.extend(b"\x00" * zero_count)
                pos += zero_count

            remaining = length - len(chunk)
            if remaining > 0:
                chunk.extend(out[pos:pos + remaining])

            out.extend(chunk)

            # Support overlapping references in the same way as the reference implementation.
            for i in range(len(chunk), length):
                if not chunk:
                    out.append(0)
                else:
                    out.append(chunk[i % len(chunk)])

    return bytes(out)


def parse_mesh(decoded: bytes) -> dict:
    if len(decoded) < 4:
        raise ValueError("Decoded mesh shorter than 4-byte header")

    tri_count = u16(decoded, 0)
    vert_count = u16(decoded, 2)
    expected = 4 + tri_count * 12 + vert_count * 16

    if len(decoded) < expected:
        raise ValueError(
            f"Decoded mesh too short: got {len(decoded)}, need at least {expected} "
            f"(triangles={tri_count}, vertices={vert_count})"
        )

    pos = 4
    raw_tris = []
    for _ in range(tri_count):
        v0, v1, v2, flags = struct.unpack_from("<BBBB", decoded, pos)
        u0, vv0, u1, vv1, u2, vv2 = struct.unpack_from("<BBBBBB", decoded, pos + 4)
        ids = u16(decoded, pos + 10)
        raw_tris.append({
            "v0": v0,
            "v1": v1,
            "v2": v2,
            "script": (flags >> 5) & 0x07,
            "terrain": flags & 0x1F,
            "texture": ids & 0x01FF,
            "region": (ids >> 9) & 0x1F,
            "chocobo": bool((ids >> 15) & 1),
            "uv": ((u0, vv0), (u1, vv1), (u2, vv2)),
        })
        pos += 12

    vertices = []
    for _ in range(vert_count):
        x, y, z = struct.unpack_from("<hhh", decoded, pos)
        vertices.append((x, y, z))
        pos += 8

    normals = []
    for _ in range(vert_count):
        x, y, z = struct.unpack_from("<hhh", decoded, pos)
        normals.append((x, y, z))
        pos += 8

    return {
        "tri_count": tri_count,
        "vert_count": vert_count,
        "triangles": raw_tris,
        "vertices": vertices,
        "normals": normals,
        "decoded_bytes": len(decoded),
        "expected_bytes": expected,
        "trailing_bytes": len(decoded) - expected,
    }


def update_minmax(mm: Dict[str, int | None], key_min: str, key_max: str, value: int) -> None:
    if mm[key_min] is None or value < mm[key_min]:
        mm[key_min] = value
    if mm[key_max] is None or value > mm[key_max]:
        mm[key_max] = value


def analyze_map(path: Path) -> dict:
    name = path.name.lower()
    if name not in MAP_CONFIG:
        raise ValueError(f"Unsupported map file name: {path.name}")

    cfg = MAP_CONFIG[name]
    raw = path.read_bytes()

    if len(raw) % SECTION_SIZE != 0:
        raise ValueError(
            f"{path.name}: file size {len(raw)} is not divisible by section size {SECTION_SIZE}"
        )

    section_count = len(raw) // SECTION_SIZE
    expected_base = cfg["base_sections"]

    summary = {
        "file": path.name,
        "map_name": cfg["name"],
        "size_bytes": len(raw),
        "sha256": sha256_file(path),
        "section_size": SECTION_SIZE,
        "sections_total": section_count,
        "sections_base_expected": expected_base,
        "sections_alternative": max(0, section_count - expected_base),
        "section_grid": [cfg["sections_x"], cfg["sections_z"]],
        "mesh_grid": [cfg["sections_x"] * 4, cfg["sections_z"] * 4],
        "game_extent_raw": [
            cfg["sections_x"] * 4 * MESH_SIZE,
            cfg["sections_z"] * 4 * MESH_SIZE,
        ],
        "meshes_base_expected": expected_base * 16,
        "meshes_parsed_total": 0,
        "meshes_failed": 0,
        "triangles_total": 0,
        "vertices_total": 0,
        "triangles_base": 0,
        "vertices_base": 0,
        "invalid_vertex_references": 0,
        "decoded_trailing_bytes_total": 0,
        "terrain_counts_base": Counter(),
        "region_counts_base": Counter(),
        "script_counts_base": Counter(),
        "texture_counts_base": Counter(),
        "chocobo_triangles_base": 0,
        "raw_local_coordinate_range_base": {
            "x_min": None, "x_max": None,
            "y_min": None, "y_max": None,
            "z_min": None, "z_max": None,
        },
        "global_coordinate_range_base": {
            "east_min": None, "east_max": None,
            "height_min": None, "height_max": None,
            "north_min": None, "north_max": None,
        },
        "failures": [],
    }

    for section_idx in range(section_count):
        section_base = section_idx * SECTION_SIZE

        for mesh_idx in range(MESHES_PER_SECTION):
            try:
                mesh_offset = u32(raw, section_base + mesh_idx * 4)

                if mesh_offset + 4 > SECTION_SIZE:
                    raise ValueError(f"mesh offset 0x{mesh_offset:X} outside section")

                mesh_header = section_base + mesh_offset
                comp_size = u32(raw, mesh_header)
                comp_start = mesh_header + 4
                comp_end = comp_start + comp_size

                if comp_end > section_base + SECTION_SIZE:
                    raise ValueError(
                        f"compressed mesh exceeds section: offset=0x{mesh_offset:X}, size={comp_size}"
                    )

                decoded = ff7_lzss_decompress(raw[comp_start:comp_end])
                mesh = parse_mesh(decoded)

                summary["meshes_parsed_total"] += 1
                summary["triangles_total"] += mesh["tri_count"]
                summary["vertices_total"] += mesh["vert_count"]
                summary["decoded_trailing_bytes_total"] += mesh["trailing_bytes"]

                # Spatial/thematic statistics only for base sections.
                if section_idx < expected_base:
                    summary["triangles_base"] += mesh["tri_count"]
                    summary["vertices_base"] += mesh["vert_count"]

                    section_row = section_idx // cfg["sections_x"]
                    section_col = section_idx % cfg["sections_x"]
                    mesh_row = mesh_idx // 4
                    mesh_col = mesh_idx % 4
                    global_mesh_row = section_row * 4 + mesh_row
                    global_mesh_col = section_col * 4 + mesh_col
                    offset_east = global_mesh_col * MESH_SIZE
                    offset_north = global_mesh_row * MESH_SIZE

                    for x, y, z in mesh["vertices"]:
                        mm = summary["raw_local_coordinate_range_base"]
                        update_minmax(mm, "x_min", "x_max", x)
                        update_minmax(mm, "y_min", "y_max", y)
                        update_minmax(mm, "z_min", "z_max", z)

                        gm = summary["global_coordinate_range_base"]
                        update_minmax(gm, "east_min", "east_max", x + offset_east)
                        update_minmax(gm, "height_min", "height_max", y)
                        update_minmax(gm, "north_min", "north_max", z + offset_north)

                    for tri in mesh["triangles"]:
                        if tri["v0"] >= mesh["vert_count"] or tri["v1"] >= mesh["vert_count"] or tri["v2"] >= mesh["vert_count"]:
                            summary["invalid_vertex_references"] += 1

                        summary["terrain_counts_base"][tri["terrain"]] += 1
                        summary["region_counts_base"][tri["region"]] += 1
                        summary["script_counts_base"][tri["script"]] += 1
                        summary["texture_counts_base"][tri["texture"]] += 1
                        if tri["chocobo"]:
                            summary["chocobo_triangles_base"] += 1

            except Exception as exc:
                summary["meshes_failed"] += 1
                summary["failures"].append({
                    "section": section_idx,
                    "mesh": mesh_idx,
                    "error": str(exc),
                })

    def counter_to_named(counter: Counter, names: Dict[int, str] | None = None) -> List[dict]:
        out = []
        for key in sorted(counter):
            row = {"id": key, "count": counter[key]}
            if names is not None:
                row["name"] = names.get(key, f"Unknown ({key})")
            out.append(row)
        return out

    summary["terrain_counts_base"] = counter_to_named(summary["terrain_counts_base"], TERRAIN_NAMES)
    summary["region_counts_base"] = counter_to_named(summary["region_counts_base"], REGION_NAMES)
    summary["script_counts_base"] = counter_to_named(summary["script_counts_base"])
    summary["texture_id_min_base"] = min(summary["texture_counts_base"], default=None)
    summary["texture_id_max_base"] = max(summary["texture_counts_base"], default=None)
    summary["texture_unique_count_base"] = len(summary["texture_counts_base"])
    del summary["texture_counts_base"]

    if name == "wm0.map":
        summary["wm0_alternative_mapping"] = [
            {"alternative_section_index": 63 + i, "replaces_base_section": base}
            for i, base in enumerate(WM0_ALTERNATIVE_BASE_SECTIONS)
        ]

    return summary


def print_summary(s: dict) -> None:
    print("\n" + "=" * 72)
    print(f"{s['file']} — {s['map_name']}")
    print("=" * 72)
    print(f"Size:                {s['size_bytes']:,} bytes")
    print(f"SHA-256:             {s['sha256']}")
    print(f"Sections:            {s['sections_total']} total "
          f"({s['sections_base_expected']} base + {s['sections_alternative']} alternative)")
    print(f"Section grid:        {s['section_grid'][0]} × {s['section_grid'][1]}")
    print(f"Base mesh grid:      {s['mesh_grid'][0]} × {s['mesh_grid'][1]}")
    print(f"Raw game extent:     {s['game_extent_raw'][0]} × {s['game_extent_raw'][1]}")
    print(f"Meshes parsed:       {s['meshes_parsed_total']}")
    print(f"Meshes failed:       {s['meshes_failed']}")
    print(f"Base triangles:      {s['triangles_base']:,}")
    print(f"Base vertices(sum):  {s['vertices_base']:,}")
    print(f"Invalid vertex refs: {s['invalid_vertex_references']}")
    print(f"Chocobo triangles:   {s['chocobo_triangles_base']:,}")
    print(f"Texture IDs:         {s['texture_id_min_base']}..{s['texture_id_max_base']} "
          f"({s['texture_unique_count_base']} unique)")

    print("\nGlobal raw-coordinate range (base map):")
    g = s["global_coordinate_range_base"]
    print(f"  game_east:   {g['east_min']} .. {g['east_max']}")
    print(f"  game_north:  {g['north_min']} .. {g['north_max']}")
    print(f"  game_height: {g['height_min']} .. {g['height_max']}")

    print("\nTerrain distribution:")
    for row in s["terrain_counts_base"]:
        print(f"  {row['id']:>2}  {row['name']:<28} {row['count']:>8,}")

    print("\nRegion distribution:")
    for row in s["region_counts_base"]:
        print(f"  {row['id']:>2}  {row['name']:<28} {row['count']:>8,}")

    print("\nScript ID distribution:")
    for row in s["script_counts_base"]:
        print(f"  {row['id']:>2}  {row['count']:>8,}")

    if s["failures"]:
        print("\nFirst failures:")
        for f in s["failures"][:10]:
            print(f"  section {f['section']}, mesh {f['mesh']}: {f['error']}")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Read-only validator for FF7 PC world-map WM*.MAP files."
    )
    parser.add_argument(
        "directory",
        nargs="?",
        default=".",
        help="Directory containing wm0.map/wm2.map/wm3.map (default: current directory)",
    )
    parser.add_argument(
        "--json",
        default="ff7_wm_validation.json",
        help="Output JSON filename (default: ff7_wm_validation.json)",
    )
    args = parser.parse_args()

    root = Path(args.directory).expanduser().resolve()
    results = {
        "validator": "ff7_wm_validate.py",
        "read_only": True,
        "section_size": SECTION_SIZE,
        "mesh_size_raw_units": MESH_SIZE,
        "maps": [],
    }

    found = 0
    for filename in ("wm0.map", "wm2.map", "wm3.map"):
        path = root / filename
        if not path.exists():
            print(f"[missing] {path}")
            continue

        found += 1
        try:
            summary = analyze_map(path)
            results["maps"].append(summary)
            print_summary(summary)
        except Exception as exc:
            print(f"[ERROR] {filename}: {exc}")

    if found == 0:
        print("No wm0.map, wm2.map, or wm3.map found.")
        return 2

    out_path = root / args.json
    with out_path.open("w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    print(f"\nJSON report written to: {out_path}")
    print("The validator does not modify any FF7 files.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
