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

ROOT=Path(__file__).resolve().parents[1]

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
def main():
    cli=argparse.ArgumentParser(description=__doc__);cli.add_argument('zip',type=Path);cli.add_argument('--source',type=Path);cli.add_argument('--port',type=int,default=5207);args=cli.parse_args()
    archive=args.zip.resolve();expected=archive.with_name(archive.name+'.sha256').read_text().split()[0]
    if hashlib.sha256(archive.read_bytes()).hexdigest()!=expected:raise ValueError('ZIP checksum mismatch')
    isolated=ROOT/'output/portable-smoke'/str(time.time_ns());isolated.mkdir(parents=True)
    with zipfile.ZipFile(archive) as z:
        for n in z.namelist():
            p=(isolated/n).resolve()
            if not p.is_relative_to(isolated) or not n.startswith('GaiaGIS/'):raise ValueError('Unsafe archive path')
        z.extractall(isolated)
    package=isolated/'GaiaGIS';exe=package/'GaiaGIS.exe'
    env={k:os.environ[k] for k in ('SYSTEMROOT','WINDIR','COMSPEC','PATHEXT') if k in os.environ}
    for key,path in {'TEMP':'scratch','TMP':'scratch','TMPDIR':'scratch','USERPROFILE':'profile','APPDATA':'profile/AppData/Roaming','LOCALAPPDATA':'profile/AppData/Local'}.items():
        p=isolated/path;p.mkdir(parents=True,exist_ok=True);env[key]=str(p)
    env['PATH']=str(Path(os.environ['SYSTEMROOT'])/'System32')
    checks={};report={'checks':checks,'isolation':'fresh ZIP / scrubbed environment / System32-only PATH; not a VM','package':str(package)}
    run=lambda a:subprocess.run([str(exe),*a],cwd=package,env=env,check=True,capture_output=True,text=True,encoding='utf8')
    test=json.loads(run(['--self-test']).stdout);checks['frozen_self_test']=test['frozen'] and test['viewer']=='verified' and test['chooser']=='tk-runtime-verified';checks['bundled_runtime']=Path(test['runtime']).is_relative_to(package)
    if args.source:
        source=args.source.resolve();sys.path.insert(0,str(ROOT/'src'))
        from gaiagis.local import validate_source
        before=validate_source(source);started=time.perf_counter()
        cold=run(['--source',str(source),'--build-only','--no-open']);(isolated/'cold-build.log').write_text(cold.stdout,encoding='utf8')
        report['cold_seconds']=time.perf_counter()-started
        manifest=json.loads((package/'output/local-workspace/gaia-workspace.json').read_text(encoding='utf8'))
        names={a['filename'] for a in manifest['assets']}
        checks['cold_core']={'gaia-mesh.bin','gaia-meta.json','gaia-poi.json','gaia-routing.bin'}.issubset(names)
        checks['cold_textures_models_native']={'gaia-textures.bin','gaia-explorer.bin','gaia-map-WM2.bin','gaia-map-WM3.bin','gaia-textures-WM2.bin','gaia-textures-WM3.bin'}.issubset(names)
        after=validate_source(source);checks['source_unchanged']=before==after
        log=(isolated/'server.log').open('w',encoding='utf8')
        server=subprocess.Popen([str(exe),'--source',str(source),'--port',str(args.port),'--no-open'],cwd=package,env=env,stdout=log,stderr=subprocess.STDOUT)
        try:
            url=f'http://127.0.0.1:{args.port}/'
            for _ in range(240):
                if server.poll() is not None:raise RuntimeError('Frozen server exited')
                try:
                    with urllib.request.urlopen(url+'__gaiagis_local__/status',timeout=1) as r:status=json.load(r)
                    break
                except OSError:time.sleep(.25)
            else:raise RuntimeError('Frozen server timeout')
            checks['localhost_status']=status['local_mode'] is True and status['version']=='2.7.0'
            report['runtime_modules']=loaded_modules(server.pid,package);checks['no_external_runtime_modules']=bool(report['runtime_modules'])
            with urllib.request.urlopen(url) as r:checks['compiled_viewer_served']=b'gaiagis-local' in r.read()
            for endpoint in ['__gaiagis_local__/assets/gaia-textures.bin','__gaiagis_local__/assets/gaia-explorer.bin']:
                with urllib.request.urlopen(url+endpoint) as r:checks[endpoint]=r.status==200 and len(r.read())>1000
            for path in ['__gaiagis_local__/assets/save00.ff7','__gaiagis_local__/../LICENSE.txt','__gaiagis_local__/file?path=C:/Windows/win.ini']:
                try:urllib.request.urlopen(url+path);checks['denied_'+path]=False
                except urllib.error.HTTPError as e:checks['denied_'+path]=e.code in (400,403,404)
        finally:server.terminate();server.wait(timeout=15);log.close()
        report['assets']=len(names)
    if not all(checks.values()):raise RuntimeError('Portable smoke failed: '+json.dumps(checks))
    target=ROOT/'output/distribution/portable-smoke.json';target.write_text(json.dumps(report,indent=2)+'\n',encoding='utf8');print(json.dumps(report,indent=2))
if __name__=='__main__':main()
