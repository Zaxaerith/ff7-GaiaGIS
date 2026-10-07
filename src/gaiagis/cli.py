import argparse
from collections import Counter
import csv
import json
import platform
import sys
from datetime import datetime, timezone
from pathlib import Path
from .analysis import geometry_summary, topology, geography
from .dataset import discover, fingerprint
from .map_reader import parse_map
from .lgp import inventory, read_entry
from .safety import WORKSPACE_ROOT, output_path
from .lzss import FormatError
from .constants import MESH_UNITS
import struct

def write_json(path, data):
    path=output_path(path)
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(data,indent=2,ensure_ascii=False,allow_nan=False)+"\n",encoding="utf-8")

def write_csv(path, rows):
    path=output_path(path)
    with path.open("w",encoding="utf-8",newline="") as stream:
        writer=csv.DictWriter(stream,fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)

def preflight_lgp(path, archive):
    entries={e["filename"].casefold():e for e in archive["entries"]}
    result={"scope":"Format preflight only; no full script/message/encounter decoder", "key_entries":{}}
    for name in ("wm0.ev","wm2.ev","wm3.ev","field.tbl","enc_w.bin","mes"):
        entry=entries.get(name)
        info={"present":entry is not None}
        if entry:
            data=read_entry(path,entry)
            info.update(size=len(data),offset=entry["offset"])
            if name.endswith(".ev"):
                calls=[struct.unpack_from("<HH",data,i) for i in range(0,min(len(data),0x400),4)]
                active=[(ident,ip) for ident,ip in calls if ident!=0xffff]
                mesh_calls=[dict(identifier=ident,word_ip=ip,mesh_col=((ident>>4)&1023)%36,
                                 mesh_row=((ident>>4)&1023)//36,function_id=ident&15)
                            for ident,ip in active if ident>>14==2]
                info.update(expected_size_match=len(data)==0x7000,active_call_entries=len(active),
                            call_types=dict(Counter(ident>>14 for ident,ip in active)),
                            instruction_pointers_in_code=all(ip*2 < len(data)-0x400 for _,ip in active),
                            seam_mesh_call_entries=[e for e in mesh_calls if e["mesh_row"] in (0,27)])
            elif name=="field.tbl":
                info.update(expected_size_match=len(data)==64*24,entry_count=len(data)//24,
                            interpretation="64 paired 12-byte field entry records; field-local coordinates, not world POIs")
            elif name=="mes":
                count=struct.unpack_from("<H",data)[0]
                offsets=list(struct.unpack_from(f"<{count}H",data,2)) if 2+count*2<=len(data) else []
                info.update(message_count_candidate=count,
                            offset_table_in_bounds=bool(offsets) and all(2+count*2<=o<len(data) for o in offsets),
                            encoding="FF7 text encoding; no text extraction in this phase")
            else:
                info.update(expected_size_match=len(data)==8*4+32*4+16*4*32,
                            interpretation="Size supports 8 Yuffie entries + 32 chocobo ratings + 16 regions x 4 encounter sets; record decoding deferred")
        result["key_entries"][name]=info
    if "ds1.tex" in entries:
        entry=entries["ds1.tex"]
        data=read_entry(path,entry)
        result["seam_texture_header"] = dict(filename="ds1.tex",offset=entry["offset"],
            texture_id_reference=56, version=struct.unpack_from("<I",data)[0],
            width=struct.unpack_from("<I",data,60)[0],height=struct.unpack_from("<I",data,64)[0],
            note="ID-to-name association from external classic texture table; TEX dimensions read from actual archive")
    return result

def validation_svg(path,grid,regions):
    # Dependency-free SVG validation diagram, deliberately no projection/CRS.
    parts=['<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="820" viewBox="0 0 1100 820">',
           '<rect width="1100" height="820" fill="white"/>',
           '<text x="60" y="30" font-size="20">WM0 validation: ocean mask and region circular centroids</text>',
           '<text x="60" y="55" font-size="14">raw +game_north downward; blue=pure ocean mesh; tan=contains non-ocean; not a GIS map</text>']
    width=(max(c['col'] for c in grid)+1)*MESH_UNITS
    height=(max(c['row'] for c in grid)+1)*MESH_UNITS
    for cell in grid:
        color="#b8def3" if cell["pure_ocean"] else "#dbbd89"
        parts.append(f'<rect x="{60+cell["col"]*25}" y="{90+cell["row"]*23}" width="25" height="23" fill="{color}" stroke="#ffffff" stroke-width="0.5"/>')
    for row in regions:
        if row['id']==17 or row['circular_x'] is None or row['circular_y'] is None: continue
        x=60+row['circular_x']/width*900
        y=90+row['circular_y']/height*644
        parts.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="4" fill="#b02020"/><text x="{x+5:.2f}" y="{y-4:.2f}" font-size="12">{row["id"]}</text>')
    for y in (90,734): parts.append(f'<path d="M60 {y}H960" stroke="#d02020" stroke-width="3" stroke-dasharray="8 4"/>')
    parts.extend(['<text x="60" y="768" font-size="14">Red dashed edges: proposed N/S topology cut; centroid labels are region IDs (CSV has names).</text>',
                  '<text x="60" y="791" font-size="14">Linear/circular centroids and resultant concentration must be read together.</text>','</svg>'])
    output_path(path).write_text('\n'.join(parts),encoding='utf-8')

def main(argv=None):
    parser=argparse.ArgumentParser(description="Read-only FF7 world dataset validator; all outputs confined to this workspace")
    parser.add_argument("source",type=Path)
    parser.add_argument("--output",type=Path,default=WORKSPACE_ROOT/"output"/"validation")
    args=parser.parse_args(argv)
    out=output_path(args.output)
    out.mkdir(parents=True,exist_ok=True)
    dataset=discover(args.source)
    before=fingerprint(dataset)
    write_json(out/"run_before.json",before)
    try:
        worlds=[]
        for map_id in (0,2,3):
            world=parse_map(dataset.files[f"wm{map_id}.map"],map_id)
            if not world.base_meshes:
                raise FormatError(f"WM{map_id}: no usable base mesh")
            summary=geometry_summary(world)
            write_json(out/f"wm{map_id}_summary.json",summary)
            worlds.append(world)
            print(f"WM{map_id}: {summary['sections']} sections, {summary['meshes_total']} meshes, "
                  f"{summary['triangles_base']} base triangles, {summary['vertex_records_base']} vertex records, "
                  f"{summary['failed_meshes']} failures")
        if any(w.failures or w.unknown_sections for w in worlds):
            raise FormatError("Partial/unknown map structure: see summaries; geography requires complete known placement")
        topo,grid=topology(worlds[0])
        write_json(out/"wm0_topology.json",topo)
        regions,terrains=geography(worlds[0])
        write_csv(out/"wm0_regions.csv",regions)
        write_csv(out/"wm0_terrain.csv",terrains)
        write_csv(out/"wm0_region_centroids.csv",regions)
        write_csv(out/"mesh_grid.csv",grid)
        archive=inventory(dataset.files["world_us.lgp"])
        write_json(out/"world_us_inventory.json",archive)
        write_json(out/"world_us_preflight.json",preflight_lgp(dataset.files["world_us.lgp"],archive))
        validation_svg(out/"wm0_validation.svg",grid,regions)
        write_json(out/"run_environment.json",dict(python=platform.python_version(),platform=platform.platform(),
                   utc=datetime.now(timezone.utc).isoformat(),workspace=str(WORKSPACE_ROOT),
                   command=sys.argv, dependencies="Python standard library only"))
    finally:
        after=fingerprint(dataset)
        original=[(r['filename'],r['size'],r['sha256']) for r in before['files']]
        final=[(r['filename'],r['size'],r['sha256']) for r in after['files']]
        write_json(out/"source_fingerprint.json",dict(before=before,after=after,source_modified=original!=final))
        if original!=final:
            raise RuntimeError("Source fingerprints changed during validation")
    print(f"Outputs: {out}; FF7 source modified: NO")
    return 0
