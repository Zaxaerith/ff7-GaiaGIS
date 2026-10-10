"""Verify a fresh extracted portable package with developer PATH/environment removed.

No remote operations. Optional --source is read-only and enables a real cold build.
This is process/environment isolation, not a fresh Windows VM.
"""
# SPDX-License-Identifier: GPL-3.0-only
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import urllib.request
import zipfile
import stat
import posixpath
from pathlib import PurePosixPath

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'src'))
from gaiagis._version import __version__
from gaiagis.output_lifecycle import OutputRun
from gaiagis.clean_output import checked_output, remove_output
from audit_package import package_layout, package_entries, mac_native_audit


def extract_package(archive,isolated):
    """Validate the whole ZIP before restoring files, modes and confined links."""
    isolated=Path(isolated).resolve()
    with zipfile.ZipFile(archive) as z:
        records=z.infolist();names={r.filename.rstrip('/') for r in records}
        if len(names)!=len(records):raise ValueError('Duplicate archive entry')
        tops={PurePosixPath(name).parts[0] for name in names if PurePosixPath(name).parts}
        if len(tops)!=1 or not tops.issubset({'GaiaGIS','GaiaGIS.app'}):raise ValueError('Unexpected archive root')
        top=next(iter(tops));root=isolated/top;links={}
        for r in records:
            name=r.filename.rstrip('/');parts=PurePosixPath(name).parts
            if not parts or '\\' in name or ':' in name or name.startswith('/') or any(p in ('','.','..') for p in name.split('/')):
                raise ValueError('Unsafe archive path')
            path=isolated.joinpath(*parts)
            if not path.resolve().is_relative_to(root):raise ValueError('Archive escaped package')
            mode=r.external_attr>>16
            if stat.S_ISLNK(mode):
                if top!='GaiaGIS.app':raise ValueError('Links only supported in macOS bundles')
                target=z.read(r).decode('utf8')
                if not target or PurePosixPath(target).is_absolute() or '\\' in target or ':' in target or not (path.parent/target).resolve().is_relative_to(root):raise ValueError('Unsafe archive link')
                links[name]=target
            elif mode and stat.S_IFMT(mode) not in (0,stat.S_IFREG,stat.S_IFDIR):raise ValueError('Unsupported archive entry')
        for name in names:
            if any(parent.as_posix() in links for parent in PurePosixPath(name).parents):raise ValueError('Archive writes through a link')
        # Resolve link chains virtually before any write, including links to directories.
        for name,target in links.items():
            resolved=posixpath.normpath(posixpath.join(posixpath.dirname(name),target));seen={name}
            while True:
                parts=PurePosixPath(resolved).parts
                linked=next((PurePosixPath(*parts[:i]).as_posix() for i in range(1,len(parts)+1) if PurePosixPath(*parts[:i]).as_posix() in links),None)
                if linked is None:break
                if linked in seen:raise ValueError('Cyclic archive link')
                seen.add(linked)
                suffix=posixpath.relpath(resolved,linked)
                resolved=posixpath.normpath(posixpath.join(posixpath.dirname(linked),links[linked],suffix))
            if not resolved.startswith(top+'/') or resolved not in names:raise ValueError('Broken or escaping archive link')
        for r in records:
            name=r.filename.rstrip('/');path=isolated/name
            if name in links:continue
            path.parent.mkdir(parents=True,exist_ok=True)
            if r.is_dir():path.mkdir(exist_ok=True)
            else:path.write_bytes(z.read(r))
            if os.name!='nt':path.chmod((r.external_attr>>16)&0o777 or (0o755 if r.is_dir() else 0o644))
        for name,target in links.items():
            path=isolated/name;path.parent.mkdir(parents=True,exist_ok=True);path.symlink_to(target)
    package_entries(root)
    return root

def loaded_modules(pid,package):
    """Prove the running frozen server resolves DLLs only inside its package/Windows."""
    import ctypes
    from ctypes import wintypes
    kernel=ctypes.WinDLL('kernel32',use_last_error=True)
    kernel.OpenProcess.argtypes=[wintypes.DWORD,wintypes.BOOL,wintypes.DWORD];kernel.OpenProcess.restype=wintypes.HANDLE
    kernel.CloseHandle.argtypes=[wintypes.HANDLE]
    kernel.K32EnumProcessModules.argtypes=[wintypes.HANDLE,ctypes.POINTER(wintypes.HMODULE),wintypes.DWORD,ctypes.POINTER(wintypes.DWORD)]
    kernel.K32GetModuleFileNameExW.argtypes=[wintypes.HANDLE,wintypes.HMODULE,wintypes.LPWSTR,wintypes.DWORD]
    handle=kernel.OpenProcess(0x410,False,pid)
    if not handle:raise ctypes.WinError(ctypes.get_last_error())
    try:
        modules=(wintypes.HMODULE*2048)();needed=wintypes.DWORD()
        if not kernel.K32EnumProcessModules(handle,modules,ctypes.sizeof(modules),ctypes.byref(needed)):raise ctypes.WinError(ctypes.get_last_error())
        if needed.value>ctypes.sizeof(modules):raise RuntimeError('Module audit capacity exceeded')
        windows=Path(os.environ['SYSTEMROOT']).resolve();names=[]
        for module in modules[:needed.value//ctypes.sizeof(wintypes.HMODULE)]:
            text=ctypes.create_unicode_buffer(32768)
            if not kernel.K32GetModuleFileNameExW(handle,module,text,len(text)):raise ctypes.WinError(ctypes.get_last_error())
            path=Path(text.value).resolve()
            if path.is_relative_to(package):names.append('package/'+path.relative_to(package).as_posix())
            elif path.is_relative_to(windows):names.append('Windows/'+path.name)
            else:raise RuntimeError('External runtime module: '+path.name)
        return names
    finally:kernel.CloseHandle(handle)
def verify(args, isolated):
    archive=checked_output(args.zip)
    expected=next(line.split()[0] for line in (archive.parent/'SHA256SUMS.txt').read_text().splitlines() if line.split()[1]==archive.name)
    if hashlib.sha256(archive.read_bytes()).hexdigest()!=expected:raise ValueError('ZIP checksum mismatch')
    package=extract_package(archive,isolated);resources,exe,target=package_layout(package);mac=target=='macos-arm64'
    if mac and (sys.platform!='darwin' or __import__('platform').machine()!='arm64'):raise RuntimeError('macOS smoke must run natively on macOS ARM64')
    env={k:os.environ[k] for k in ('SYSTEMROOT','WINDIR','COMSPEC','PATHEXT') if k in os.environ}
    for key,path in {'TEMP':'scratch','TMP':'scratch','TMPDIR':'scratch','USERPROFILE':'profile','APPDATA':'profile/AppData/Roaming','LOCALAPPDATA':'profile/AppData/Local'}.items():
        p=isolated/path;p.mkdir(parents=True,exist_ok=True);env[key]=str(p)
    workspace=isolated/'workspace' if mac else package;workspace.mkdir(exist_ok=True)
    env.update(HOME=str(isolated/'profile'),GAIAGIS_WORKSPACE_ROOT=str(workspace),PYTHONDONTWRITEBYTECODE='1',PYTHONNOUSERSITE='1',PYTHONUTF8='1')
    env['PATH']='/usr/bin:/bin:/usr/sbin:/sbin' if mac else str(Path(os.environ['SYSTEMROOT'])/'System32')
    checks={};report={'checks':checks,'target':target,'isolation':'fresh ZIP / scrubbed environment / system-only PATH; not a user desktop','package':str(package)}
    run=lambda a:subprocess.run([str(exe),*a],cwd=isolated,env=env,check=True,capture_output=True,text=True,encoding='utf8',timeout=600)
    result=workspace/'self-test.json';run(['--self-test','--report',str(result)])
    test=json.loads(result.read_text(encoding='utf8'))
    checks['frozen_self_test']=test['frozen'] and test['viewer']=='verified' and test['chooser']=='tk-runtime-verified'
    checks['bundled_runtime']=Path(test['runtime']).resolve().is_relative_to(package)
    checks['resource_root']=Path(test['resource_root'])==resources
    checks['workspace_root']=Path(test['workspace_root'])==workspace
    for key in ('tcl_library','tk_library'):
        # CPython 3.14 can embed scripts in Tcl zipfs; native dependencies are audited separately.
        checks['bundled_'+key]=test[key].startswith('//zipfs:') or Path(test[key]).resolve().is_relative_to(package)
    if mac:
        checks['native_arm64']=test['architecture']=='arm64'
        report['native_audit']=mac_native_audit(package)

    def probe(command,receipt,synthetic):
        receipt.unlink(missing_ok=True)
        with (isolated/'server.log').open('w',encoding='utf8') as log:
            server=subprocess.Popen([str(exe),*command],cwd=isolated,env=env,stdout=log,stderr=subprocess.STDOUT)
            try:
                for _ in range(240):
                    if server.poll() is not None:raise RuntimeError('Frozen server exited')
                    try:
                        ready=json.loads(receipt.read_text(encoding='utf8'));url=ready['url']
                        with urllib.request.urlopen(url+'__gaiagis_local__/status',timeout=1) as response:status=json.load(response)
                        break
                    except (OSError,ValueError):time.sleep(.25)
                else:raise RuntimeError('Frozen server timeout')
                label='synthetic_' if synthetic else 'real_'
                checks[label+'localhost_status']=status['local_mode'] is True and status['version']==__version__
                with urllib.request.urlopen(url+'__gaiagis_local__/workspace') as response:manifest=json.load(response)
                checks[label+'manifest']=manifest['schema']=='gaiagis-workspace' and str(workspace) not in json.dumps(manifest)
                with urllib.request.urlopen(url) as response:checks[label+'compiled_viewer']=b'gaiagis-local' in response.read()
                for name in (['gaia-meta.json','gaia-mesh.bin'] if synthetic else ['gaia-textures.bin','gaia-explorer.bin']):
                    record=next(a for a in manifest['assets'] if a['filename']==name)
                    with urllib.request.urlopen(url+'__gaiagis_local__/assets/'+name) as response:data=response.read()
                    checks[label+name]=len(data)==record['bytes'] and hashlib.sha256(data).hexdigest()==record['sha256']
                for path in ['__gaiagis_local__/assets/save00.ff7','__gaiagis_local__/%2e%2e/LICENSE.txt','__gaiagis_local__/file?path=/etc/passwd','.gaiagis-local.json']:
                    try:urllib.request.urlopen(url+path);checks[label+'denied_'+path]=False
                    except urllib.error.HTTPError as error:checks[label+'denied_'+path]=error.code in (400,403,404)
                for header,value in [('Host','outside.invalid'),('Origin','https://outside.invalid')]:
                    try:urllib.request.urlopen(urllib.request.Request(url,headers={header:value}));checks[label+'denied_'+header]=False
                    except urllib.error.HTTPError as error:checks[label+'denied_'+header]=error.code==403
                if not mac:
                    report[label+'runtime_modules']=loaded_modules(server.pid,package)
                    checks[label+'no_external_runtime_modules']=bool(report[label+'runtime_modules'])
            finally:
                server.terminate()
                try:server.wait(timeout=15)
                except subprocess.TimeoutExpired:server.kill();server.wait(timeout=5)
    probe(['--smoke-server',str(workspace/'synthetic-ready.json')],workspace/'synthetic-ready.json',True)
    if args.source:
        source=args.source.resolve();sys.path.insert(0,str(ROOT/'src'))
        from gaiagis.local import validate_source
        before=validate_source(source);started=time.perf_counter()
        cold=run(['--source',str(source),'--build-only','--no-open']);(isolated/'cold-build.log').write_text(cold.stdout,encoding='utf8')
        report['cold_seconds']=time.perf_counter()-started
        manifest=json.loads((workspace/'output/local-workspace/gaia-workspace.json').read_text(encoding='utf8'))
        names={a['filename'] for a in manifest['assets']}
        checks['cold_core']={'gaia-mesh.bin','gaia-meta.json','gaia-poi.json','gaia-routing.bin'}.issubset(names)
        checks['cold_textures_models_native']={'gaia-textures.bin','gaia-explorer.bin','gaia-map-WM2.bin','gaia-map-WM3.bin','gaia-textures-WM2.bin','gaia-textures-WM3.bin'}.issubset(names)
        run(['--source',str(source),'--build-only','--no-open'])
        launch=json.loads((workspace/'output/local-workspace/local-launch.json').read_text(encoding='utf8'))
        checks['warm_geometry_reused']=next(step for step in launch['build']['steps'] if step['step']=='geometry')['reused']
        probe(['--source',str(source),'--port',str(args.port),'--no-open','--ready-report',str(workspace/'real-ready.json')],workspace/'real-ready.json',False)
        after=validate_source(source);checks['source_unchanged']=before==after
        report['assets']=len(names)
    if not all(checks.values()):raise RuntimeError('Portable smoke failed: '+json.dumps(checks))
    print(json.dumps(report,indent=2))
    return report
def main(argv=None):
    cli=argparse.ArgumentParser(description=__doc__)
    cli.add_argument('zip',type=Path)
    cli.add_argument('--source',type=Path)
    cli.add_argument('--port',type=int,default=5207)
    cli.add_argument('--keep-artifacts',action='store_true',help='Keep input ZIP/build artifacts; extracted smoke tree is always disposable')
    args=cli.parse_args(argv)
    archive=checked_output(args.zip)
    with OutputRun('smoke',package_links=True) as job:
        verify(args,job.path)
    if not args.keep_artifacts and archive.parent in (ROOT/'output/distribution',ROOT/'output/release'):
        remove_output(archive.parent,package_links=True)
        print('Temporary package artifacts removed.')
    print('Extracted smoke package/temp tree removed.')
    return 0

if __name__=='__main__':raise SystemExit(main())
