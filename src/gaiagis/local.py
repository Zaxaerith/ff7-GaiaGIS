"""Private, read-only localhost launcher for the generated Gaia workspace."""
# SPDX-License-Identifier: GPL-3.0-only
import argparse
import errno
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import mimetypes
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import time
import traceback
from urllib.parse import unquote, urlsplit
import webbrowser

from .build_workspace import ASSETS, build_workspace
from .dataset import child_ci, discover, fingerprint
from .safety import WORKSPACE_ROOT, output_path
from .web_export import sha256

PREFIX = '/__gaiagis_local__/'
CONFIG = WORKSPACE_ROOT / '.gaiagis-local.json'


def runtime_path(path):
    resolved=output_path(path)
    if resolved!=path.absolute():raise ValueError('Local runtime output cannot be redirected by filesystem links')
    return resolved


def runtime_environment():
    scratch = runtime_path(WORKSPACE_ROOT / 'output/runtime')
    scratch.mkdir(parents=True, exist_ok=True)
    env = os.environ.copy()
    env.update(TEMP=str(scratch), TMP=str(scratch), TMPDIR=str(scratch),
               PYTHONDONTWRITEBYTECODE='1', PYTHONUTF8='1',
               NPM_CONFIG_CACHE=str(runtime_path(WORKSPACE_ROOT / '.cache/npm')),
               PYTHONPATH=str(WORKSPACE_ROOT / 'src'))
    os.environ.update({k: env[k] for k in ('TEMP','TMP','TMPDIR','PYTHONDONTWRITEBYTECODE','PYTHONUTF8')})
    return env


def validate_source(source):
    try:
        dataset = discover(Path(source))
        missing = [name for name in ('wm0.bot','wm2.bot','wm3.bot') if name not in dataset.files]
        if missing:raise ValueError('Missing ' + ', '.join(missing))
        report = fingerprint(dataset)
        field = child_ci(dataset.wm_directory.parent, 'field')
        archive = child_ci(field, 'flevel.lgp') if field else None
        if not archive or not archive.is_file():raise ValueError('Missing data/field/flevel.lgp')
        report['files'].append(dict(filename='flevel.lgp',size=archive.stat().st_size,sha256=sha256(archive),known_match=None))
        if any(r['size'] <= 0 for r in report['files']):raise ValueError('Empty source file')
        return report
    except (OSError, ValueError) as error:
        raise ValueError('FF7 installation not recognized or unreadable. Expected '
                         'ff7/workingdir/data/wm/wm0.map (or data/wm/wm0.map), '
                         'WM0/WM2/WM3 MAP/BOT, world_us.lgp and data/field/flevel.lgp. '
                         + str(error)) from error


def workspace_path(path, source):
    root = output_path(Path(path))
    if root.is_relative_to(Path(source).resolve()):raise ValueError('Workspace cannot be inside game source')
    # Local output may be deleted/rebuilt; keep it away from source and sealed evidence.
    if not root.is_relative_to(WORKSPACE_ROOT / 'output') or root == WORKSPACE_ROOT / 'output':
        raise ValueError('Local workspace must be a subdirectory of project output/')
    for name in ('climate_v2','climate_v21','climate_v22','gis','3d','reconstruction','validation'):
        protected = WORKSPACE_ROOT / 'output' / name
        if root.is_relative_to(protected) or protected.is_relative_to(root):
            raise ValueError('Workspace overlaps protected research evidence')
    return root


def choose_source(value, remember=False):
    if value is None and CONFIG.is_file():
        try:value = json.loads(CONFIG.read_text(encoding='utf8'))['source']
        except (OSError, ValueError, KeyError):raise ValueError('Local config invalid; provide --source to replace it')
    if value is None:
        if not sys.stdin.isatty():raise ValueError('Provide --source YOUR_FF7_INSTALLATION (or --remember-source once)')
        value = input('FF7 installation root: ').strip().strip('"')
    source = Path(value).resolve()
    report = validate_source(source)
    if remember:
        runtime_path(CONFIG).write_text(json.dumps({'source':str(source)},indent=2)+'\n',encoding='utf8')
    return source, report


def web_signature():
    web = WORKSPACE_ROOT / 'web'
    paths = list((web/'src').rglob('*')) + [web/n for n in ('package.json','package-lock.json','index.html','vite.config.ts','tsconfig.json')]
    paths += [web/'scripts/build-release.mjs',web/'scripts/release-policy.mjs',WORKSPACE_ROOT/'LICENSE', WORKSPACE_ROOT/'THIRD_PARTY_NOTICES.md',web/'public/favicon.svg',web/'public/THREE-LICENSE.txt']
    digest = hashlib.sha256()
    for path in sorted(p for p in paths if p.is_file()):
        digest.update(path.relative_to(WORKSPACE_ROOT).as_posix().encode());digest.update(path.read_bytes())
    return digest.hexdigest()


def prepare_viewer(env):
    web = WORKSPACE_ROOT / 'web'
    stamp = runtime_path(WORKSPACE_ROOT / '.cache/local-viewer.json')
    signature = web_signature()
    dist = runtime_path(web / 'dist-release')
    try:previous = json.loads(stamp.read_text(encoding='utf8')) if stamp.is_file() else {}
    except (OSError, ValueError):previous = {}
    if not isinstance(previous,dict):previous={}
    files = previous.get('files',{})
    if previous.get('signature')==signature and files and all((dist/n).is_file() and sha256(dist/n)==h for n,h in files.items()):
        print('Reuse code-only Viewer',flush=True);return dist
    npm = shutil.which('npm.cmd' if os.name=='nt' else 'npm')
    if not npm:raise RuntimeError('Node.js/npm unavailable. Install Node.js >=22.12 and run npm ci in web/.')
    if not (web/'node_modules').is_dir():raise RuntimeError('Viewer dependencies unavailable. Run npm ci in web/ once.')
    print('Building code-only Viewer',flush=True)
    subprocess.run([npm,'run','build:release'],cwd=web,env=env,check=True)
    stamp.parent.mkdir(parents=True,exist_ok=True)
    stamp.write_text(json.dumps({'signature':signature,'files':{p.relative_to(dist).as_posix():sha256(p) for p in dist.rglob('*') if p.is_file()}},sort_keys=True),encoding='utf8')
    return dist


def server_manifest(root):
    manifest = json.loads((root/'gaia-workspace.json').read_text(encoding='utf8'))
    if not isinstance(manifest,dict) or manifest.get('schema')!='gaiagis-workspace' or manifest.get('version')!=1:raise ValueError('Invalid workspace manifest')
    if not isinstance(manifest.get('assets'),list) or len(manifest['assets'])>len(ASSETS):raise ValueError('Invalid asset inventory')
    names=set()
    for asset in manifest['assets']:
        name=asset['filename']
        if name not in ASSETS or name in names:raise ValueError('Unapproved workspace asset')
        if not isinstance(asset.get('bytes'),int) or not 0<asset['bytes']<=160_000_000:raise ValueError('Invalid asset size')
        if asset.get('dependencies')!=ASSETS[name][2]:raise ValueError('Invalid asset dependencies')
        path=(root/name).resolve()
        if not path.is_relative_to(root) or not path.is_file() or sha256(path)!=asset['sha256'] or path.stat().st_size!=asset['bytes']:
            raise ValueError('Workspace asset checksum/path invalid')
        names.add(name)
    if not {'gaia-meta.json','gaia-mesh.bin'}.issubset(names):raise ValueError('Core geometry unavailable')
    if any(set(a['dependencies'])-names for a in manifest['assets']):raise ValueError('Workspace dependency missing')
    return manifest


def make_server(root, dist, host='127.0.0.1', port=5173):
    root=output_path(Path(root));dist=output_path(Path(dist))
    manifest=server_manifest(root)
    assets={a['filename']:a for a in manifest['assets']}
    static=set()
    for p in dist.rglob('*'):
        if not p.is_file():continue
        name=p.relative_to(dist).as_posix()
        if name in ('index.html','favicon.svg','LICENSE.txt','THIRD_PARTY_NOTICES.txt','THREE-LICENSE.txt') or p.parent==dist/'assets' and p.suffix in ('.js','.css'):
            static.add(name)
    if 'index.html' not in static:raise ValueError('Viewer index unavailable')

    class Handler(BaseHTTPRequestHandler):
        def log_message(self,*args):pass  # no absolute paths or per-asset console noise
        def do_HEAD(self):self.respond(head=True)
        def do_GET(self):self.respond()
        def respond(self,head=False):
            authority=self.headers.get('Host','')
            allowed={f'{h}:{self.server.server_port}' for h in (host,'127.0.0.1','localhost')}
            origin=self.headers.get('Origin')
            if authority not in allowed or origin and origin not in {f'http://{h}' for h in allowed}:
                self.send_error(403);return
            raw=urlsplit(self.path).path;path=unquote(raw)
            if '\\' in path or '%' in path or any(part in ('.','..') for part in path.split('/')):
                self.send_error(404);return
            try:
                if path==PREFIX+'status':
                    payload=json.dumps({'local_mode':True,'version':'2.0.1'}).encode();mime='application/json'
                elif path==PREFIX+'workspace':payload=json.dumps(manifest,sort_keys=True).encode();mime='application/json'
                elif path.startswith(PREFIX+'assets/'):
                    name=path[len(PREFIX+'assets/'):]
                    if name not in assets:raise ValueError('Unlisted asset')
                    target=(root/name).resolve()
                    if not target.is_relative_to(root):raise ValueError('Asset escaped workspace')
                    payload=target.read_bytes();record=assets[name]
                    if len(payload)!=record['bytes'] or hashlib.sha256(payload).hexdigest()!=record['sha256']:raise ValueError('Changed asset')
                    mime=mimetypes.guess_type(name)[0] or 'application/octet-stream'
                else:
                    name='index.html' if path=='/' else path.removeprefix('/')
                    if name not in static:raise ValueError('Not a static Viewer file')
                    target=(dist/name).resolve()
                    if not target.is_relative_to(dist):raise ValueError('Static path escaped')
                    payload=target.read_bytes();mime=mimetypes.guess_type(name)[0] or 'application/octet-stream'
                    if name=='index.html':
                        payload=payload.replace(b'<head>',b'<head><meta name="gaiagis-local" content="true">',1)
                self.send_response(200)
                self.send_header('Content-Type',mime)
                self.send_header('Content-Length',str(len(payload)))
                self.send_header('Cache-Control','no-store')
                self.send_header('X-Content-Type-Options','nosniff')
                self.send_header('Cross-Origin-Resource-Policy','same-origin')
                self.end_headers()
                if not head:self.wfile.write(payload)
            except (OSError,ValueError):self.send_error(404)

    class LocalHTTPServer(ThreadingHTTPServer):
        allow_reuse_address=False
        def server_bind(self):
            if os.name=='nt':self.socket.setsockopt(socket.SOL_SOCKET,socket.SO_EXCLUSIVEADDRUSE,1)
            super().server_bind()

    for candidate in ([0] if port==0 else range(port,min(port+100,65536))):
        try:return LocalHTTPServer((host,candidate),Handler)
        except OSError as error:
            if error.errno!=errno.EADDRINUSE and getattr(error,'winerror',None)!=10048:raise
    raise RuntimeError('No free local port available')


def parser():
    cli=argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--source',type=Path)
    cli.add_argument('--workspace',type=Path,default=WORKSPACE_ROOT/'output/local-workspace')
    cli.add_argument('--host',default='127.0.0.1')
    cli.add_argument('--port',type=int,default=5173)
    for flag in ('no-open','rebuild','clean-invalid','remember-source','debug'):
        cli.add_argument('--'+flag,action='store_true')
    cli.add_argument('--build-only',action='store_true',help=argparse.SUPPRESS)
    return cli


def main(argv=None):
    args=parser().parse_args(argv);began=time.perf_counter();server=None
    if not 0<=args.port<=65535:raise SystemExit('Port must be between 0 and 65535')
    env=runtime_environment()
    try:
        print('Detecting FF7 installation / checking source fingerprints',flush=True)
        source,before=choose_source(args.source,args.remember_source)
        print(before['compatibility'],flush=True)
        out=workspace_path(args.workspace,source)
        print('Checking workspace',flush=True)
        try:
            report=build_workspace(source,out,rebuild=args.rebuild,clean_invalid=args.clean_invalid,allow_optional_failure=True)
        except ModuleNotFoundError as error:
            if error.name!='osgeo' or args.build_only:raise
            from scripts.build_gaia import qgis_environment
            qgis=Path(os.environ.get('GAIAGIS_QGIS_ROOT',r'C:\MYAPPLY\QGIS 4.2.2'))
            runtime=qgis/'bin/python.exe'
            if not runtime.is_file():raise RuntimeError('QGIS/GDAL environment unavailable. Set GAIAGIS_QGIS_ROOT to your QGIS installation.') from error
            command=[str(runtime),'-B','-m','gaiagis.local','--source',str(source),'--workspace',str(out),'--build-only']
            if args.rebuild:command.append('--rebuild')
            if args.clean_invalid:command.append('--clean-invalid')
            subprocess.run(command,cwd=WORKSPACE_ROOT,env=qgis_environment(qgis),check=True)
            report=json.loads((out/'local-launch.json').read_text(encoding='utf8'))['build']
        after=validate_source(source)
        if [(r['filename'],r['size'],r['sha256'].lower()) for r in before['files']]!=[(r['filename'],r['size'],r['sha256'].lower()) for r in after['files']]:
            raise RuntimeError('FF7 source fingerprint changed')
        build_seconds=time.perf_counter()-began
        # Private report; source paths never reach HTTP.
        evidence={'source_before':before,'source_after':after,'ff7_source_modified':'NO','build':report,'build_seconds':build_seconds}
        (out/'local-launch.json').write_text(json.dumps(evidence,sort_keys=True,indent=2)+'\n',encoding='utf8')
        if args.build_only:return 0
        print('Starting Viewer',flush=True);dist=prepare_viewer(env)
        server=make_server(out,dist,args.host,args.port)
        url=f'http://{args.host if args.host!="0.0.0.0" else "127.0.0.1"}:{server.server_port}/'
        evidence['ready_seconds']=time.perf_counter()-began
        (out/'local-launch.json').write_text(json.dumps(evidence,sort_keys=True,indent=2)+'\n',encoding='utf8')
        print(f'GaiaGIS: {url}\nWorkspace: {out}\nReady in {evidence["ready_seconds"]:.2f}s. Ctrl+C to stop.',flush=True)
        if not args.no_open:webbrowser.open(url)
        server.serve_forever(poll_interval=0.2)
    except KeyboardInterrupt:
        print('\nGaiaGIS stopped.',flush=True)
    except Exception as error:
        print(f'GaiaGIS local start failed: {error}',file=sys.stderr)
        if args.debug:traceback.print_exc()
        return 1
    finally:
        if server:server.server_close()
    return 0


if __name__=='__main__':raise SystemExit(main())
