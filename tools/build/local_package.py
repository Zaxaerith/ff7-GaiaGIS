"""Reproducible-input Windows x64 portable build. No publication/network operation."""
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

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'src'))
from gaiagis._version import __version__
def run(args,**kwargs):subprocess.run(args,cwd=ROOT,check=True,**kwargs)
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def main():
    cli=argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--skip-web-build',action='store_true')
    cli.add_argument('--release-tag',help='Exact annotated tag checked out by the release runner')
    cli.add_argument('--output-dir',type=Path,default=ROOT/'output/distribution')
    args=cli.parse_args()
    if sys.platform!='win32' or platform.machine().upper() not in ('AMD64','X86_64'):raise RuntimeError('Build on Windows x64')
    if sys.version_info[:3]!=(3,14,7):raise RuntimeError('Use the pinned CPython 3.14.7 build runtime')
    out=args.output_dir.resolve()
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
    scratch=ROOT/'output/runtime';scratch.mkdir(parents=True,exist_ok=True)
    os.environ.update(TEMP=str(scratch),TMP=str(scratch),TMPDIR=str(scratch),PYTHONDONTWRITEBYTECODE='1',PYINSTALLER_CONFIG_DIR=str(ROOT/'.cache/pyinstaller'),NPM_CONFIG_CACHE=str(ROOT/'.cache/npm'))
    epoch=int(subprocess.check_output(['git','-c',f'safe.directory={ROOT.as_posix()}','show','-s','--format=%ct','HEAD'],cwd=ROOT,text=True).strip())
    os.environ['SOURCE_DATE_EPOCH']=str(epoch)
    def add_file(z,path,name):
        info=zipfile.ZipInfo(name,time.gmtime(max(315532800,epoch))[:6]);info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16
        z.writestr(info,path.read_bytes())
    npm=shutil.which('npm.cmd')
    if not args.skip_web_build:run([npm,'--prefix','web','run','build:release'])
    run([npm,'--prefix','web','run','audit:release'])
    version=__version__
    run([sys.executable,'-B','-m','PyInstaller','--noconfirm','--clean','--onedir','--noupx','--name','GaiaGIS','--paths',str(ROOT/'src'),'--distpath',str(out/'build'),'--workpath',str(out/'work'),'--specpath',str(out),'--collect-data','gaiagis','--exclude-module','gaiagis.climate','--exclude-module','scripts','--hidden-import','tkinter','--hidden-import','tkinter.filedialog',str(ROOT/'tools/build/portable_entry.py')])
    package=out/'build/GaiaGIS'
    # Explicit public allowlist. Never copy output/, .cache/, installation or workspace.
    for source,target in [(ROOT/'web/dist-release',package/'web/dist-release'),(ROOT/'config/default.toml',package/'config/default.toml')]:
        if source.is_dir():shutil.copytree(source,target,dirs_exist_ok=True)
        else:target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,target)
    shutil.copyfile(ROOT/'LICENSE',package/'LICENSE.txt')
    shutil.copyfile(ROOT/'THIRD_PARTY_NOTICES.md',package/'THIRD_PARTY_NOTICES.txt')
    shutil.copyfile(ROOT/'docs/user/getting-started.md',package/'README.txt')
    for data in (ROOT/'src/gaiagis').rglob('*'):
        if data.is_file() and data.suffix in ('.json','.tsv') and 'climate' not in data.parts:
            target=package/'_internal/gaiagis'/data.relative_to(ROOT/'src/gaiagis');target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(data,target)
    licenses=package/'licenses';licenses.mkdir(exist_ok=True)
    import PyInstaller
    shutil.copyfile(Path(PyInstaller.__file__).parent.parent/'pyinstaller-6.22.3.dist-info/licenses/COPYING.txt',licenses/'PYINSTALLER.txt')
    python_license=Path(sys.base_prefix)/'LICENSE.txt'
    if not python_license.is_file():raise RuntimeError('Python LICENSE.txt missing')
    shutil.copyfile(python_license,licenses/'PYTHON.txt')
    import tkinter as tk
    window=tk.Tk();window.withdraw()
    for name,library in [('TCL',window.tk.eval('info library')),('TK',window.tk.eval('set tk_library'))]:
        handle=window.tk.call('open',library+'/license.terms','r')
        text=window.tk.call('read',handle);window.tk.call('close',handle)
        (licenses/(name+'.txt')).write_text(text,encoding='utf8')
    window.destroy()
    shutil.copyfile(ROOT/'tools/build/licenses/OPENSSL.txt',licenses/'OPENSSL.txt')
    # Include the exact build scripts and authored source needed to reproduce this binary.
    source_zip=package/'GaiaGIS-source.zip'
    tracked=subprocess.check_output(['git','-c',f'safe.directory={ROOT.as_posix()}','ls-files','-z'],cwd=ROOT).decode().split('\0')
    additions=[] if args.release_tag else subprocess.check_output([*git,'ls-files','--others','--exclude-standard','-z'],cwd=ROOT).decode().split('\0')
    def corresponding_source(name):
        return (name.startswith(('src/gaiagis/','web/src/','web/scripts/','docs/','tools/build/','crs/','.github/workflows/')) or name in ('README.md','CHANGELOG.md','pyproject.toml','LICENSE','THIRD_PARTY_NOTICES.md','gaiagis/__init__.py','config/default.toml','web/package.json','web/package-lock.json','web/tsconfig.json','web/vite.config.ts','web/index.html','web/public/favicon.svg','web/public/THREE-LICENSE.txt'))
    with zipfile.ZipFile(source_zip,'w',zipfile.ZIP_DEFLATED) as z:
        for name in sorted(set(tracked+additions)):
            p=ROOT/name
            if not name or not p.is_file() or not corresponding_source(name):continue
            add_file(z,p,name)
    viewer={p.relative_to(package/'web/dist-release').as_posix():digest(p) for p in (package/'web/dist-release').rglob('*') if p.is_file()}
    manifest=dict(schema='gaiagis-portable',version=1,tool_version=version,source_base_commit=head,source_ref=args.release_tag,source_dirty=dirty,artifact_kind='tag-release' if args.release_tag else 'development-validation-only',source_archive_sha256=digest(source_zip),viewer=viewer)
    (package/'portable-manifest.json').write_text(json.dumps(manifest,sort_keys=True,indent=2)+'\n',encoding='utf8')
    run([sys.executable,'-B',str(ROOT/'tools/build/audit_package.py'),str(package)])
    archive=out/f'GaiaGIS-v{version}-windows-x64.zip'
    with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
        for p in sorted(package.rglob('*')):
            if p.is_file():add_file(z,p,'GaiaGIS/'+p.relative_to(package).as_posix())
    checksum=digest(archive);(out/(archive.name+'.sha256')).write_text(f'{checksum}  {archive.name}\n',encoding='ascii')
    (out/'SHA256SUMS.txt').write_text(f'{checksum}  {archive.name}\n',encoding='ascii')
    print(json.dumps(dict(zip=str(archive),bytes=archive.stat().st_size,sha256=checksum),indent=2))
if __name__=='__main__':main()
