"""Native Windows x64 / macOS ARM64 portable build. No publication operation."""
# SPDX-License-Identifier: GPL-3.0-only
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import sys
import zipfile
import time
import plistlib
import importlib.metadata
import sysconfig

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'src'))
from gaiagis._version import __version__
from gaiagis.output_lifecycle import OutputRun
from gaiagis.clean_output import checked_output, remove_output
from audit_package import package_entries, mac_native_audit
def run(args,**kwargs):subprocess.run(args,cwd=ROOT,check=True,**kwargs)
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()

def native_target():
    if sys.platform=='win32' and platform.machine().upper() in ('AMD64','X86_64'):return 'windows-x64'
    if sys.platform=='darwin' and platform.machine()=='arm64':
        translated=subprocess.run(['/usr/sbin/sysctl','-in','sysctl.proc_translated'],capture_output=True,text=True)
        if translated.returncode==0 and translated.stdout.strip()=='1':raise RuntimeError('Rosetta builds are not supported')
        return 'macos-arm64'
    raise RuntimeError('Build natively on Windows x64 or macOS ARM64; cross builds are not supported')

def zip_package(package,archive,epoch):
    """Preserve POSIX permissions and internal links without traversing them."""
    with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
        for path in sorted(package_entries(package)):
            name=package.name+'/'+path.relative_to(package).as_posix()
            info=zipfile.ZipInfo(name+'/' if path.is_dir() and not path.is_symlink() else name,time.gmtime(max(315532800,epoch))[:6])
            info.create_system=3;info.compress_type=zipfile.ZIP_DEFLATED
            info.external_attr=path.lstat().st_mode<<16
            if path.is_symlink():data=os.readlink(path).encode('utf8')
            elif path.is_file():data=path.read_bytes()
            else:data=b'';info.external_attr|=0x10
            z.writestr(info,data)
def build(args, scratch):
    target=native_target();mac=target=='macos-arm64'
    if sys.version_info[:3]!=(3,14,7):raise RuntimeError('Use the pinned CPython 3.14.7 build runtime')
    out=checked_output(args.output_dir)
    if out not in (ROOT/'output/distribution',ROOT/'output/release'):raise ValueError('Use output/distribution or output/release for package artifacts')
    if not out.is_relative_to(ROOT/'output'):raise ValueError('Build outputs must stay within workspace/output')
    git=['git','-c',f'safe.directory={ROOT.as_posix()}']
    head=subprocess.check_output([*git,'rev-parse','HEAD'],cwd=ROOT,text=True).strip()
    dirty=bool(subprocess.check_output([*git,'status','--porcelain'],cwd=ROOT,text=True).strip())
    if args.release_tag:
        if args.release_tag!='v'+__version__:raise ValueError('Tag differs from authoritative version')
        ref='refs/tags/'+args.release_tag
        if subprocess.check_output([*git,'cat-file','-t',ref],cwd=ROOT,text=True).strip()!='tag':raise ValueError('Release tag must be annotated')
        if subprocess.check_output([*git,'rev-parse',ref+'^{commit}'],cwd=ROOT,text=True).strip()!=head or dirty:raise ValueError('Release requires clean exact-tag checkout')
    out.mkdir(parents=True,exist_ok=True)
    scratch.mkdir(parents=True,exist_ok=True)
    os.environ.update(TEMP=str(scratch),TMP=str(scratch),TMPDIR=str(scratch),PYTHONDONTWRITEBYTECODE='1',PYINSTALLER_CONFIG_DIR=str(ROOT/'.cache/pyinstaller'),NPM_CONFIG_CACHE=str(ROOT/'.cache/npm'),XDG_CACHE_HOME=str(ROOT/'.cache'),GAIAGIS_WORKSPACE_ROOT=str(scratch/'runtime-workspace'))
    epoch=int(subprocess.check_output(['git','-c',f'safe.directory={ROOT.as_posix()}','show','-s','--format=%ct','HEAD'],cwd=ROOT,text=True).strip())
    os.environ['SOURCE_DATE_EPOCH']=str(epoch)
    def add_file(z,path,name):
        info=zipfile.ZipInfo(name,time.gmtime(max(315532800,epoch))[:6]);info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16
        z.writestr(info,path.read_bytes())
    npm=shutil.which('npm.cmd' if os.name=='nt' else 'npm')
    if not npm:raise RuntimeError('Build requires Node/npm; the portable runtime does not')
    if not args.skip_web_build:run([npm,'--prefix','web','run','build:release'])
    run([npm,'--prefix','web','run','audit:release'])
    version=__version__
    freeze=[sys.executable,'-B','-m','PyInstaller','--noconfirm','--clean','--onedir','--noupx','--name','GaiaGIS','--paths',str(ROOT/'src'),'--distpath',str(out/'build'),'--workpath',str(out/'work'),'--specpath',str(out),'--collect-data','gaiagis','--exclude-module','gaiagis.climate','--exclude-module','scripts','--exclude-module','osgeo','--hidden-import','tkinter','--hidden-import','tkinter.filedialog']
    # The checkout adapter can hide package data from --collect-data discovery.
    for name in ('atlas_data/content.json','traversal_profiles.json','wm0_texture_catalog.tsv','native_texture_catalog.tsv'):
        source=ROOT/'src/gaiagis'/name
        destination=(Path('gaiagis')/Path(name).parent).as_posix()
        freeze+=['--add-data',str(source)+':'+destination]
    if mac:freeze+=['--windowed','--target-arch','arm64','--osx-bundle-identifier','org.gaiagis.viewer']
    run([*freeze,str(ROOT/'tools/build/portable_entry.py')])
    package=out/('build/GaiaGIS.app' if mac else 'build/GaiaGIS')
    resources=package/'Contents/Resources' if mac else package
    # Explicit public allowlist. Never copy output/, .cache/, installation or workspace.
    for source,destination in [(ROOT/'web/dist-release',resources/'web/dist-release'),(ROOT/'config/default.toml',resources/'config/default.toml')]:
        if source.is_dir():shutil.copytree(source,destination,dirs_exist_ok=True)
        else:destination.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,destination)
    shutil.copyfile(ROOT/'LICENSE',resources/'LICENSE.txt')
    shutil.copyfile(ROOT/'THIRD_PARTY_NOTICES.md',resources/'THIRD_PARTY_NOTICES.txt')
    shutil.copyfile(ROOT/'docs/user/getting-started.md',resources/'README.txt')
    # Authored package data was collected before bundle signing.
    licenses=resources/'licenses';licenses.mkdir(exist_ok=True)
    distribution=importlib.metadata.distribution('pyinstaller')
    copying=next(p for p in distribution.files if str(p).endswith('/licenses/COPYING.txt'))
    shutil.copyfile(distribution.locate_file(copying),licenses/'PYINSTALLER.txt')
    python_license=next((p for p in (Path(sys.base_prefix)/'LICENSE.txt',Path(sys.base_prefix)/'LICENSE',Path(sysconfig.get_path('stdlib'))/'LICENSE.txt',Path(sys.base_prefix)/'Resources/English.lproj/Documentation/LICENSE.txt') if p.is_file()),None)
    if python_license is None:raise RuntimeError('Python licence missing from the pinned build runtime')
    shutil.copyfile(python_license,licenses/'PYTHON.txt')
    import tkinter as tk
    window=tk.Tk();window.withdraw()
    try:
        for name,library in [('TCL',window.tk.eval('info library')),('TK',window.tk.eval('set tk_library'))]:
            try:
                # Tcl's filesystem API also reads Windows' embedded zipfs.
                handle=window.tk.call('open',library+'/license.terms','r')
            except tk.TclError:
                directory=Path(library)
                # Framework Resources may hold the licence beside Scripts.
                licence=directory.parent/'license.terms'
                if not licence.is_file():raise RuntimeError(f'{name} licence missing from the pinned build runtime: {directory}')
                shutil.copyfile(licence,licenses/(name+'.txt'))
            else:
                try:text=window.tk.call('read',handle)
                finally:window.tk.call('close',handle)
                (licenses/(name+'.txt')).write_text(text,encoding='utf8')
    finally:
        window.destroy()
    shutil.copyfile(ROOT/'tools/build/licenses/OPENSSL.txt',licenses/'OPENSSL.txt')
    # Include the exact build scripts and authored source needed to reproduce this binary.
    source_zip=resources/'GaiaGIS-source.zip'
    tracked=subprocess.check_output(['git','-c',f'safe.directory={ROOT.as_posix()}','ls-files','-z'],cwd=ROOT).decode().split('\0')
    additions=[] if args.release_tag else subprocess.check_output([*git,'ls-files','--others','--exclude-standard','-z'],cwd=ROOT).decode().split('\0')
    def corresponding_source(name):
        return (name.startswith(('src/gaiagis/','web/src/','web/scripts/','docs/','tools/build/','crs/','.github/workflows/')) or name in ('README.md','CHANGELOG.md','pyproject.toml','LICENSE','THIRD_PARTY_NOTICES.md','gaiagis/__init__.py','config/default.toml','web/package.json','web/package-lock.json','web/tsconfig.json','web/vite.config.ts','web/index.html','web/public/favicon.svg','web/public/THREE-LICENSE.txt'))
    with zipfile.ZipFile(source_zip,'w',zipfile.ZIP_DEFLATED) as z:
        for name in sorted(set(tracked+additions)):
            p=ROOT/name
            if not name or not p.is_file() or not corresponding_source(name):continue
            add_file(z,p,name)
    viewer={p.relative_to(resources/'web/dist-release').as_posix():digest(p) for p in (resources/'web/dist-release').rglob('*') if p.is_file()}
    manifest=dict(schema='gaiagis-portable',version=1,tool_version=version,target=target,build_os=platform.mac_ver()[0] if mac else platform.release(),source_base_commit=head,source_ref=args.release_tag,source_dirty=dirty,artifact_kind='tag-release' if args.release_tag else 'development-validation-only',source_archive_sha256=digest(source_zip),viewer=viewer)
    if mac:
        native=mac_native_audit(package,verify_signature=False)
        plist_path=package/'Contents/Info.plist'
        plist=plistlib.loads(plist_path.read_bytes())
        plist.update(CFBundleShortVersionString=version,CFBundleVersion=version,LSMinimumSystemVersion=native['minimum_os'])
        plist_path.write_bytes(plistlib.dumps(plist))
        manifest.update(minimum_os=native['minimum_os'],signing='ad-hoc',notarized=False)
    (resources/'portable-manifest.json').write_text(json.dumps(manifest,sort_keys=True,indent=2)+'\n',encoding='utf8')
    if mac:
        run(['/usr/bin/codesign','--force','--deep','--sign','-',str(package)])
        mac_native_audit(package)
    run([sys.executable,'-B',str(ROOT/'tools/build/audit_package.py'),str(package)])
    archive=out/f'GaiaGIS-v{version}-{target}.zip'
    zip_package(package,archive,epoch)
    checksum=digest(archive);(out/(archive.name+'.sha256')).write_text(f'{checksum}  {archive.name}\n',encoding='ascii')
    (out/'SHA256SUMS.txt').write_text(f'{checksum}  {archive.name}\n',encoding='ascii')
    print(json.dumps(dict(zip=str(archive),bytes=archive.stat().st_size,sha256=checksum),indent=2))
    return archive

def main(argv=None):
    cli=argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--skip-web-build',action='store_true')
    cli.add_argument('--release-tag',help='Exact annotated tag checked out by the release runner')
    cli.add_argument('--output-dir',type=Path,default=ROOT/'output/distribution')
    cli.add_argument('--keep-artifacts',action='store_true',help='Explicitly retain ZIP and build files after successful smoke (required by Actions)')
    args=cli.parse_args(argv)
    out=checked_output(args.output_dir)
    if out not in (ROOT/'output/distribution',ROOT/'output/release'):raise ValueError('Invalid package output directory')
    # A previous retained .app contains legitimate internal framework links.
    # Remove only this dedicated build tree through the package-aware boundary.
    if out.exists():
        for child in out.iterdir():remove_output(child,package_links=True)
    with OutputRun('package',package_links=True) as job:
        try:
            archive=build(args,job.path/'tmp')
            from portable_smoke import main as smoke
            smoke([str(archive),'--keep-artifacts'])
            if not args.keep_artifacts:
                remove_output(out,package_links=True)
                print('Package validated; ZIP and intermediate build removed. Use --keep-artifacts to retain them.')
        except BaseException:
            if out.exists():
                package_entries(out)
                out.rename(job.path/'artifacts')
            raise
    return 0

if __name__=='__main__':raise SystemExit(main())
