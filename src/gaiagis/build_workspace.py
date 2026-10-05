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
    'gaia-presentation.json': ('presentation', 'shared', []),
}

# Source dependencies, not a Steam-version switch. Generator/transport versions
# stay unchanged because the produced geometry and schemas have not changed.
SOURCE_DEPENDENCIES = {
    'gaia-meta.json': ['wm0.map'], 'gaia-mesh.bin': ['wm0.map'],
    'gaia-poi.json': ['wm0.map', 'world_us.lgp', 'flevel.lgp'],
    'gaia-encounters.json': ['wm0.map', 'world_us.lgp'],
    'gaia-events.json': ['wm0.map', 'world_us.lgp', 'flevel.lgp'],
    'gaia-routing.bin': ['wm0.map'], 'gaia-textures.bin': ['world_us.lgp'],
    'gaia-map-WM2.bin': ['wm2.map'], 'gaia-map-WM3.bin': ['wm3.map'],
    'gaia-textures-WM2.bin': ['world_us.lgp'], 'gaia-textures-WM3.bin': ['world_us.lgp'],
    'gaia-transitions.json': ['wm0.map', 'wm2.map', 'wm3.map', 'world_us.lgp', 'flevel.lgp'],
    'gaia-explorer.bin': ['world_us.lgp','char.lgp','flevel.lgp'],
    'gaia-presentation.json': ['audio.dat','audio.fmt'],
}

def write_manifest(directory, sources):
    """No wall-clock timestamp, absolute input path or machine identity."""
    assets = []
    for filename, (kind, map_id, dependencies) in ASSETS.items():
        path = directory / filename
        if path.is_file():
            assets.append(dict(filename=filename, type=kind, mapId=map_id,
                               sha256=sha256(path), bytes=path.stat().st_size,
                               dependencies=dependencies, generator_version='explorer-party-1' if kind=='explorer' else GENERATOR_VERSION))
    names = {a['filename'] for a in assets}
    if any(set(a['dependencies']) - names for a in assets):
        raise ValueError('Workspace dependency missing; manifest was not written')
    manifest = dict(schema='gaiagis-workspace', version=1, tool_version=TOOL_VERSION,
                    generator_version=GENERATOR_VERSION, timestamp_policy='omitted',
                    sources=dict(sorted(sources.items())), assets=assets)
    path = output_path(directory / 'gaia-workspace.json')
    path.write_text(json.dumps(manifest, sort_keys=True, indent=2) + '\n', encoding='utf8')
    return manifest

def reusable(manifest, sources, directory, names, _visited=None):
    if not isinstance(manifest,dict) or not isinstance(manifest.get('sources'),dict) or not isinstance(manifest.get('assets'),list) or not all(isinstance(a,dict) for a in manifest['assets']) or manifest.get('schema') != 'gaiagis-workspace' or manifest.get('version') != 1 or manifest.get('tool_version') != TOOL_VERSION or manifest.get('generator_version') != GENERATOR_VERSION:
        return False
    visited = set() if _visited is None else _visited
    for name in names:
        if name not in ASSETS or name in visited:return False
        previous = manifest.get('sources', {})
        if any(previous.get(k) != sources.get(k) for k in SOURCE_DEPENDENCIES[name]):return False
        record = next((a for a in manifest.get('assets', []) if a.get('filename') == name), None)
        path = directory / name
        if not record or not path.is_file() or record.get('bytes') != path.stat().st_size or record.get('sha256') != sha256(path):
            return False
        if name=='gaia-explorer.bin' and record.get('generator_version')!='explorer-party-1':return False
        dependencies = ASSETS[name][2]
        if record.get('dependencies') != dependencies:return False
        if dependencies and not reusable(manifest, sources, directory, dependencies, visited | {name}):return False
    return True

def ensure_stage1(source, stage1, cache):
    dataset = discover(source)
    for candidate in (stage1,cache):
        metadata = candidate / 'reconstruction' / 'build_metadata.json'
        if metadata.is_file() and (candidate / 'gis/gaia_geographic.gpkg').is_file():
            build = json.loads(metadata.read_text(encoding='utf8'))
            previous = next((r['sha256'] for r in build['source_fingerprint']['before']['files'] if r['filename'] == 'wm0.map'), None)
            if previous and previous.lower() == sha256(dataset.files['wm0.map']):
                return candidate
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

def build_workspace(source, destination, stage1=None, *, rebuild=False, allow_optional_failure=False, clean_invalid=False):
    source = Path(source).resolve();out = output_path(Path(destination))
    if out.is_relative_to(source):raise ValueError('Workspace output must not be inside the selected source dataset')
    # Existing filesystem links must not redirect an exporter into another tree.
    for name in [*ASSETS,'gaia-workspace.json','gaia-map-WM2.json','gaia-map-WM3.json','build-report.json','local-launch.json','.build']:
        if not output_path(out/name).is_relative_to(out):raise ValueError('Workspace asset link escapes output root')
    out.mkdir(parents=True, exist_ok=True)
    cache = output_path(out / '.build');cache.mkdir(parents=True, exist_ok=True)
    dataset = discover(source)
    sources = {r['filename']: r['sha256'].lower() for r in fingerprint(dataset)['files']}
    field = child_ci(dataset.wm_directory.parent, 'field')
    field_archive = child_ci(field, 'flevel.lgp') if field else None
    if field_archive:sources['flevel.lgp'] = sha256(field_archive)
    char=child_ci(field,'char.lgp') if field else None
    if char:sources['char.lgp']=sha256(char)
    sound=child_ci(dataset.wm_directory.parent,'sound')
    for name in ('audio.dat','audio.fmt'):
        asset=child_ci(sound,name) if sound else None
        if asset:sources[name]=sha256(asset)
    old_path = out / 'gaia-workspace.json'
    try:old = json.loads(old_path.read_text(encoding='utf8'))
    except (FileNotFoundError, ValueError):old = None
    results = []
    def step(label, names, action):
        if not rebuild and reusable(old, sources, out, names):
            print(f'Reuse {label}', flush=True);results.append(dict(step=label, reused=True));return
        print(f'Build {label}', flush=True)
        if clean_invalid:
            for name in names:
                target=output_path(out/name)
                if target.is_file():target.unlink()
        try:
            action();results.append(dict(step=label, reused=False))
        except Exception as error:
            if label=='geometry' or not allow_optional_failure and label!='presentation':raise
            # Failed/stale optional assets must never enter a fresh manifest.
            for name in names:
                target=output_path(out/name)
                if target.is_file():target.unlink()
            print(f'Optional component unavailable: {label}: {error}', flush=True)
            results.append(dict(step=label,reused=False,unavailable=True,error=str(error)))
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
    for label,name in [('WM2','gaia-map-WM2.bin'),('textures-WM2','gaia-textures-WM2.bin'),('WM3','gaia-map-WM3.bin'),('textures-WM3','gaia-textures-WM3.bin'),('transitions','gaia-transitions.json')]:
        def native(label=label,name=name):
            if any(not (out/d).is_file() for d in ASSETS[name][2]):raise ValueError('Optional dependency unavailable')
            command = [sys.executable, '-B', str(WORKSPACE_ROOT/'scripts/build_multimap_assets.py'), str(source), '--output', str(out), '--only', label]
            subprocess.run(command, cwd=WORKSPACE_ROOT, check=True)
        step(label,[name],native)
    step('explorer', ['gaia-explorer.bin'], lambda: build_explorer(source, out/'gaia-explorer.bin', version=2))
    from .presentation import build_presentation
    step('presentation',['gaia-presentation.json'],lambda:build_presentation(source,out/'gaia-presentation.json'))
    after = {r['filename']:r['sha256'].lower() for r in fingerprint(dataset)['files']}
    if any(after[k] != v for k,v in sources.items() if k in after):raise RuntimeError('Source fingerprint changed during workspace build')
    if field_archive and sha256(field_archive)!=sources['flevel.lgp']:raise RuntimeError('Field source fingerprint changed during workspace build')
    for asset,name in [(char,'char.lgp')]+[(child_ci(sound,n) if sound else None,n) for n in ('audio.dat','audio.fmt')]:
        if asset and sha256(asset)!=sources[name]:raise RuntimeError('Optional source fingerprint changed during build')
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
