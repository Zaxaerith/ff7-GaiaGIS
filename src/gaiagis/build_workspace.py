"""Build an incremental private Gaia workspace with existing stable exporters."""
# SPDX-License-Identifier: GPL-3.0-only
import argparse
from dataclasses import asdict
import json
from pathlib import Path
import subprocess
import sys

from .dataset import discover, fingerprint, child_ci
from .safety import WORKSPACE_ROOT, output_path
from .web_export import build_web_assets, sha256

TOOL_VERSION = '2.0.0'
GENERATOR_VERSION = 'workspace-1'
ASSETS = {
    'gaia-meta.json': ('metadata', 'WM0', []),
    'gaia-mesh.bin': ('geometry', 'WM0', ['gaia-meta.json']),
    'gaia-poi.json': ('locations', 'WM0', ['gaia-mesh.bin']),
    'gaia-encounters.json': ('encounters', 'WM0', ['gaia-mesh.bin']),
    'gaia-events.json': ('events', 'WM0', ['gaia-mesh.bin']),
    'gaia-routing.bin': ('routing', 'WM0', ['gaia-mesh.bin']),
    'gaia-textures.bin': ('textures', 'WM0', ['gaia-mesh.bin']),
    'gaia-map-WM2.bin': ('WM2', 'WM2', []),
    'gaia-map-WM3.bin': ('WM3', 'WM3', []),
    'gaia-textures-WM2.bin': ('textures-WM2', 'WM2', ['gaia-map-WM2.bin']),
    'gaia-textures-WM3.bin': ('textures-WM3', 'WM3', ['gaia-map-WM3.bin']),
    'gaia-transitions.json': ('transitions', 'shared', ['gaia-mesh.bin']),
    'gaia-explorer.bin': ('explorer', 'shared', ['gaia-mesh.bin']),
}

def write_manifest(directory, sources):
    """No wall-clock timestamp, absolute input path or machine identity."""
    assets = []
    for filename, (kind, map_id, dependencies) in ASSETS.items():
        path = directory / filename
        if path.is_file():
            assets.append(dict(filename=filename, type=kind, mapId=map_id,
                               sha256=sha256(path), bytes=path.stat().st_size,
                               dependencies=dependencies))
    names = {a['filename'] for a in assets}
    if any(set(a['dependencies']) - names for a in assets):
        raise ValueError('Workspace dependency missing; manifest was not written')
    manifest = dict(schema='gaiagis-workspace', version=1, tool_version=TOOL_VERSION,
                    generator_version=GENERATOR_VERSION, timestamp_policy='omitted',
                    sources=dict(sorted(sources.items())), assets=assets)
    path = output_path(directory / 'gaia-workspace.json')
    path.write_text(json.dumps(manifest, sort_keys=True, indent=2) + '\n', encoding='utf8')
    return manifest

def reusable(manifest, sources, directory, names):
    if not manifest or manifest.get('schema') != 'gaiagis-workspace' or manifest.get('version') != 1 or manifest.get('tool_version') != TOOL_VERSION or manifest.get('generator_version') != GENERATOR_VERSION or manifest.get('sources') != sources:
        return False
    for name in names:
        record = next((a for a in manifest.get('assets', []) if a.get('filename') == name), None)
        path = directory / name
        if not record or not path.is_file() or record.get('bytes') != path.stat().st_size or record.get('sha256') != sha256(path):
            return False
    return True

def ensure_stage1(source, stage1, cache):
    metadata = stage1 / 'reconstruction' / 'build_metadata.json'
    dataset = discover(source)
    if metadata.is_file() and (stage1 / 'gis/gaia_geographic.gpkg').is_file():
        build = json.loads(metadata.read_text(encoding='utf8'))
        previous = next((r['sha256'] for r in build['source_fingerprint']['before']['files'] if r['filename'] == 'wm0.map'), None)
        if previous and previous.lower() == sha256(dataset.files['wm0.map']):
            return stage1
    # Same existing mapping/caps/GIS algorithms, in this workspace's private cache.
    # No QGIS project, root CRS file or prior generated product is overwritten.
    from .reconstruction import Mapping, read_config
    from .map_reader import parse_map
    from .caps import build_caps
    from .gis_export import make_crs, export_packages
    config = read_config(WORKSPACE_ROOT / 'config/default.toml')
    world = parse_map(dataset.files['wm0.map'], 0)
    if world.failures or world.unknown_sections:
        raise ValueError('Incomplete WM0 source')
    mapping = Mapping(*world.extent, config)
    caps = build_caps(world, mapping)
    crs = make_crs(config, cache / 'crs')
    export_packages(cache, world, caps, mapping, crs)
    build = dict(config=asdict(config), source_triangles=sum(len(m.triangles) for m in world.base_meshes),
                 caps=[dict(triangles=len(c.triangles)) for c in caps], phi_max_deg=mapping.phi_max,
                 source_fingerprint=dict(before=fingerprint(dataset)))
    target = cache / 'reconstruction/build_metadata.json'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(build, sort_keys=True, indent=2), encoding='utf8')
    return cache

def build_workspace(source, destination, stage1=None):
    source = Path(source).resolve();out = output_path(Path(destination))
    if out.is_relative_to(source):raise ValueError('Workspace output must not be inside the selected source dataset')
    out.mkdir(parents=True, exist_ok=True)
    cache = output_path(out / '.build');cache.mkdir(parents=True, exist_ok=True)
    dataset = discover(source)
    sources = {r['filename']: r['sha256'].lower() for r in fingerprint(dataset)['files']}
    field = child_ci(dataset.wm_directory.parent, 'field')
    field_archive = child_ci(field, 'flevel.lgp') if field else None
    if field_archive:sources['flevel.lgp'] = sha256(field_archive)
    old_path = out / 'gaia-workspace.json'
    try:old = json.loads(old_path.read_text(encoding='utf8'))
    except (FileNotFoundError, ValueError):old = None
    results = []
    def step(label, names, action):
        if reusable(old, sources, out, names):
            print(f'Reuse {label}', flush=True);results.append(dict(step=label, reused=True));return
        print(f'Build {label}', flush=True);action();results.append(dict(step=label, reused=False))
    def geometry():
        base = ensure_stage1(source, Path(stage1).resolve() if stage1 else WORKSPACE_ROOT/'output', cache)
        build_web_assets(base, out)
    step('geometry', ['gaia-meta.json', 'gaia-mesh.bin'], geometry)
    from .poi import build_poi
    from .encounters import build_encounters
    from .world_events import build_events
    from .routing import export_routing
    from .texture_pack import build_texture_pack
    from .explorer_export import build_explorer
    step('locations', ['gaia-poi.json'], lambda: build_poi(source, out/'gaia-poi.json'))
    step('encounters', ['gaia-encounters.json'], lambda: build_encounters(source, out/'gaia-encounters.json'))
    step('events', ['gaia-events.json'], lambda: build_events(source, out/'gaia-events.json'))
    step('routing', ['gaia-routing.bin'], lambda: export_routing(source, out/'gaia-routing.bin'))
    step('textures', ['gaia-textures.bin'], lambda: build_texture_pack(source, out/'gaia-meta.json', out/'gaia-textures.bin'))
    def native():
        command = [sys.executable, '-B', str(WORKSPACE_ROOT/'scripts/build_multimap_assets.py'), str(source), '--output', str(out)]
        subprocess.run(command, cwd=WORKSPACE_ROOT, check=True)
    step('native-maps-and-transitions', ['gaia-map-WM2.bin','gaia-map-WM3.bin','gaia-textures-WM2.bin','gaia-textures-WM3.bin','gaia-transitions.json'], native)
    step('explorer', ['gaia-explorer.bin'], lambda: build_explorer(source, out/'gaia-explorer.bin', version=2))
    after = {r['filename']:r['sha256'].lower() for r in fingerprint(dataset)['files']}
    if any(after[k] != v for k,v in sources.items() if k in after):raise RuntimeError('Source fingerprint changed during workspace build')
    manifest = write_manifest(out, sources)
    return dict(assets=len(manifest['assets']), steps=results, manifest_sha256=sha256(old_path), ff7_source_modified='NO')

def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source',required=True,type=Path)
    parser.add_argument('--output',required=True,type=Path)
    parser.add_argument('--stage1',type=Path,help='Optional compatible existing Stage 1 cache')
    args=parser.parse_args(argv)
    try:
        report=build_workspace(args.source,args.output,args.stage1)
    except ModuleNotFoundError as error:
        if error.name!='osgeo':raise
        # Reuse the installed QGIS environment helper; never install a framework.
        import os
        sys.path.insert(0,str(WORKSPACE_ROOT))
        from scripts.build_gaia import qgis_environment
        qgis=Path(os.environ.get('GAIAGIS_QGIS_ROOT',r'C:\MYAPPLY\QGIS 4.2.2'))
        runtime=qgis/'bin/python.exe'
        if not runtime.is_file():raise RuntimeError('Fresh geometry generation needs GDAL/QGIS; set GAIAGIS_QGIS_ROOT or provide --stage1') from error
        resolved=['--source',str(args.source.resolve()),'--output',str(args.output.resolve())]
        if args.stage1:resolved+=['--stage1',str(args.stage1.resolve())]
        result=subprocess.run([str(runtime),'-B','-m','gaiagis.build_workspace',*resolved],cwd=WORKSPACE_ROOT,env=qgis_environment(qgis))
        if result.returncode:raise SystemExit(result.returncode)
        return
    print(json.dumps(report,indent=2))

if __name__=='__main__':main()
