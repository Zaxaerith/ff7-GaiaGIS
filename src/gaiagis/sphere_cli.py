import argparse
from dataclasses import asdict
from datetime import datetime,timezone
from pathlib import Path
import platform
from .safety import WORKSPACE_ROOT,output_path
from .dataset import discover,fingerprint
from .map_reader import parse_map
from .reconstruction import Mapping,read_config
from .caps import build_caps,derived_topology
from .cli import write_json

def main(argv=None):
    parser = argparse.ArgumentParser(description="Build mathematical Gaia sphere from read-only WM0")
    parser.add_argument("--source",type=Path,required=True)
    parser.add_argument("--output",type=Path,default=WORKSPACE_ROOT/"output")
    parser.add_argument("--config",type=Path,default=WORKSPACE_ROOT/"config"/"default.toml")
    parser.add_argument("--radius",type=float)
    parser.add_argument("--vertical-scale",type=float)
    parser.add_argument("--ring-count",type=int)
    parser.add_argument("--antimeridian-game-east",type=float)
    parser.add_argument("--flip-latitude",action="store_true",default=None)
    parser.add_argument("--flatten",action="store_true")
    args = parser.parse_args(argv)
    output = output_path(args.output)
    output.mkdir(parents=True,exist_ok=True)
    config = read_config(args.config,radius_m=args.radius,vertical_scale_m_per_raw_unit=args.vertical_scale,
                         ring_count=args.ring_count,antimeridian_game_east=args.antimeridian_game_east,
                         flip_latitude=args.flip_latitude,flatten=args.flatten)
    dataset = discover(args.source)
    before = fingerprint(dataset)
    snapshot = output/"reconstruction"/"source_before.json"
    if snapshot.exists():
        import json
        previous = json.loads(snapshot.read_text(encoding="utf-8"))
        if previous["files"]!=before["files"]:
            raise RuntimeError("Source differs from this output directory's original snapshot; use a new output directory")
    else:
        write_json(snapshot,before)
    world = parse_map(dataset.files["wm0.map"],0)
    if world.failures or world.unknown_sections:
        raise RuntimeError(f"WM0 incomplete: failures={world.failures}, unknown sections={world.unknown_sections}")
    mapping = Mapping(*world.extent,config)
    caps = build_caps(world,mapping)
    triangle_count = sum(len(m.triangles) for m in world.base_meshes)
    print(f"Method: {config.method}; radius_m: {config.radius_m}; phi_max_deg: {mapping.phi_max:.12f}",flush=True)
    print(f"Source base triangles: {triangle_count}; synthetic cap triangles: {sum(len(c.triangles) for c in caps)}",flush=True)
    topology = derived_topology(world,caps)
    if caps and topology["cap_or_attachment_nonmanifold_edges"]:
        raise RuntimeError("New polar cap attachment is not closed")
    from .gis_export import make_crs,export_packages
    from .glb import write_glb
    crs = make_crs(config,WORKSPACE_ROOT/"crs")
    gis = export_packages(output,world,caps,mapping,crs,lambda message:print(message,flush=True))
    print("Writing GLB with original source triangle indices",flush=True)
    glb = write_glb(output/"3d"/"gaia_sphere.glb",world,caps,mapping)
    print("Creating and reopening headless QGIS project, rendering validation views",flush=True)
    from .qgis_project import create_project
    qgis,application = create_project(output,crs,WORKSPACE_ROOT/"qgis"/"Gaia.qgz")
    after = fingerprint(dataset)
    comparison = [{"filename":a["filename"],"before_sha256":a["sha256"],"after_sha256":b["sha256"],
                   "before_size":a["size"],"after_size":b["size"],"unchanged":a["sha256"]==b["sha256"] and a["size"]==b["size"]}
                  for a,b in zip(before["files"],after["files"],strict=True)]
    if not all(row["unchanged"] for row in comparison):
        raise RuntimeError("Source fingerprint changed during build")
    from osgeo import gdal
    metadata = dict(schema_version=1,created_utc=datetime.now(timezone.utc).isoformat(),config=asdict(config),
                    classification={"source_WM0":"Observed","inverse_Mercator":"Reconstructed",
                                    "sphere_radius":"Assumed","vertical_scale":"Assumed","polar_caps":"Reconstructed","projections":"Derived"},
                    input_directory=str(dataset.wm_directory),source_fingerprint=dict(before=before,after=after,comparison=comparison),
                    ff7_source_modified="NO",width_raw=world.extent[0],height_raw=world.extent[1],phi_max_deg=mapping.phi_max,
                    source_triangles=triangle_count,alternative_sections="Excluded from base surface; Stage 0 validation retained",
                    caps=[dict(hemisphere=c.hemisphere,boundary_samples=c.boundary_count,
                               added_vertices=len(c.vertices)-c.boundary_count,export_vertex_records=len(c.vertices),
                               intermediate_rings=config.ring_count,triangles=len(c.triangles)) for c in caps],
                    topology=topology,gis=gis,glb=glb,qgis=qgis,
                    runtime=dict(python=platform.python_version(),gdal=gdal.VersionInfo("RELEASE_NAME")),
                    output_files=[str(output/"gis"/f) for f in ("gaia_raw.gpkg","gaia_geographic.gpkg","gaia_projections.gpkg")]+
                                 [str(output/"3d"/"gaia_sphere.glb"),str(WORKSPACE_ROOT/"qgis"/"Gaia.qgz")])
    write_json(output/"reconstruction"/"build_metadata.json",metadata)
    write_json(output/"reconstruction"/"topology.json",topology)
    print("Antimeridian: short-edge unwrap + split with lineage; FF7 source modified: NO",flush=True)
    for path in metadata["output_files"]:
        print(path,flush=True)
    return 0
