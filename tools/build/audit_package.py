"""Fail closed public portable-package audit; no generated or user data permitted."""
# SPDX-License-Identifier: GPL-3.0-only
import hashlib
import json
from pathlib import Path
import sys
import zipfile
import re
import types
import marshal
import os
import subprocess
import stat

FORBIDDEN={'.ff7','.lgp','.map','.bot','.tex','.hrc','.rsd','.p','.a','.iso','.rom','.ct','.png','.jpg','.jpeg','.webp'}
PRIVATE=re.compile(rb'[A-Za-z]:[\\/](?:Users|SteamLibrary|MYAPPLICA|MYAPPLY|Project)[\\/]|/(?:Users|home)/[^/\s\x00]+/|/(?:private/)?var/folders/[^\s\x00]+|/(?:private)/tmp/[^\s\x00]+|/tmp/(?:pip-|package-|smoke-|qa-)[^\s\x00]+',re.I)

def package_layout(root):
    root=Path(root).resolve()
    mac=root.suffix=='.app'
    return (root/'Contents/Resources',root/'Contents/MacOS/GaiaGIS','macos-arm64') if mac else (root,root/'GaiaGIS.exe','windows-x64')


def package_entries(root):
    """Walk lexical entries once, never follow directory links or accept escapes."""
    root=Path(root).resolve();entries=[]
    for directory,dirs,files in os.walk(root,followlinks=False):
        for name in dirs+files:
            path=Path(directory)/name
            info=path.lstat()
            if getattr(info,'st_file_attributes',0)&0x400 and not path.is_symlink():
                raise ValueError('Unexpected reparse point in package')
            if not path.resolve().is_relative_to(root) or path.is_symlink() and not path.exists():
                raise ValueError('Broken or escaping package link: '+path.relative_to(root).as_posix())
            entries.append(path)
    return entries


MACHO={b'\xfe\xed\xfa\xce',b'\xce\xfa\xed\xfe',b'\xfe\xed\xfa\xcf',b'\xcf\xfa\xed\xfe',b'\xca\xfe\xba\xbe',b'\xbe\xba\xfe\xca',b'\xca\xfe\xba\xbf',b'\xbf\xba\xfe\xca'}

def mac_native_audit(root, *, verify_signature=True):
    """Audit every real Mach-O, including frameworks; not just the launcher."""
    root=Path(root).resolve();_,exe,_=package_layout(root);binaries=[];minimum=(11,0)
    for path in package_entries(root):
        if path.is_symlink() or not path.is_file():continue
        with path.open('rb') as stream:magic=stream.read(4)
        if magic in MACHO:binaries.append(path)
    if exe not in binaries:raise ValueError('Missing Mach-O launcher')
    details={}
    for path in binaries:
        archs=subprocess.check_output(['/usr/bin/lipo','-archs',str(path)],text=True).split()
        if archs!=['arm64']:raise ValueError('Non-native binary: '+path.relative_to(root).as_posix())
        if path==exe and not path.stat().st_mode&stat.S_IXUSR:raise ValueError('Launcher executable permission missing')
        load=subprocess.check_output(['/usr/bin/otool','-l',str(path)],text=True)
        rpaths=re.findall(r'\bpath (.+?) \(offset \d+\)',load)
        versions=re.findall(r'\bminos (\d+(?:\.\d+)+)',load)+re.findall(r'cmd LC_VERSION_MIN_MACOSX\s+cmdsize \d+\s+version (\d+(?:\.\d+)+)',load)
        for version in versions:minimum=max(minimum,tuple(map(int,version.split('.'))))
        dependencies=[]
        for line in subprocess.check_output(['/usr/bin/otool','-L',str(path)],text=True).splitlines()[1:]:
            name=line.strip().split(' (',1)[0]
            # First entry of a dylib may be its own LC_ID_DYLIB, not a load command.
            ids=re.findall(r'cmd LC_ID_DYLIB\s+cmdsize \d+\s+name (.+?) \(offset \d+\)',load)
            if name in ids:continue
            dependencies.append(name)
        details[path]=(rpaths,dependencies)
    def expand(name,path):
        if name.startswith('@loader_path/') :return path.parent/name[len('@loader_path/'):]
        if name.startswith('@executable_path/'):return exe.parent/name[len('@executable_path/'):]
        return Path(name)
    for path,(rpaths,dependencies) in details.items():
        for name in rpaths:
            expanded=expand(name,path)
            if not expanded.is_absolute() or not any(expanded.resolve().is_relative_to(base.resolve()) for base in (root,Path('/System/Library'),Path('/usr/lib'))):
                raise ValueError('External/unresolved Mach-O rpath: '+path.relative_to(root).as_posix()+' -> '+name)
        for name in dependencies:
            if name.startswith('/') and any(Path(name).resolve().is_relative_to(Path(base).resolve()) for base in ('/System/Library','/usr/lib')):continue
            if name.startswith('@rpath/'):
                bases=[expand(r,path) for r in rpaths]+[expand(r,exe) for r in details[exe][0]]
                candidates=[base/name[len('@rpath/'):] for base in bases if base.is_absolute()]
            else:candidates=[expand(name,path)]
            if not any(p.is_absolute() and p.resolve().is_relative_to(root) and p.is_file() for p in candidates):
                raise ValueError('External/unresolved Mach-O dependency: '+path.relative_to(root).as_posix()+' -> '+name)
        if verify_signature:subprocess.run(['/usr/bin/codesign','--verify','--strict',str(path)],check=True,capture_output=True)
    if verify_signature:
        subprocess.run(['/usr/bin/codesign','--verify','--deep','--strict',str(root)],check=True,capture_output=True)
        signature=subprocess.run(['/usr/bin/codesign','--display','--verbose=2',str(root)],check=True,capture_output=True,text=True)
        if 'Signature=adhoc' not in signature.stderr:raise ValueError('Expected verified ad-hoc bundle signature')
    return {'mach_o_binaries':len(binaries),'architecture':'arm64','minimum_os':'.'.join(map(str,minimum)),'signing':'ad-hoc' if verify_signature else 'pending'}
def audit(root):
    root=Path(root).resolve();resources,exe,target=package_layout(root)
    files=[p for p in package_entries(root) if p.is_file()];errors=[]
    required=['LICENSE.txt','THIRD_PARTY_NOTICES.txt','README.txt','licenses/PYTHON.txt','licenses/PYINSTALLER.txt','licenses/TCL.txt','licenses/TK.txt','licenses/OPENSSL.txt','portable-manifest.json','GaiaGIS-source.zip','web/dist-release/index.html','config/default.toml']
    if not exe.is_file():errors.append('Missing native launcher')
    for n in required:
        if not (resources/n).is_file():errors.append('Missing '+n)
    if (resources/'portable-manifest.json').is_file():
        manifest=json.loads((resources/'portable-manifest.json').read_text(encoding='utf8'))
        if manifest.get('target')!=target:errors.append('Target mismatch')
        if digest_source:=manifest.get('source_archive_sha256'):
            if not (resources/'GaiaGIS-source.zip').is_file() or hashlib.sha256((resources/'GaiaGIS-source.zip').read_bytes()).hexdigest()!=digest_source:errors.append('Source archive checksum mismatch')
    for p in files:
        name=p.relative_to(root).as_posix()
        if p.suffix.lower() in FORBIDDEN or any(x in Path(name).parts for x in ('output','.cache','tests','node_modules','local-workspace')) or p.name.startswith('gaia-') or p.name in ('gaia-workspace.json','local-launch.json','.gaiagis-local.json'):errors.append('Forbidden '+name)
        if p.suffix.lower() in ('.json','.txt','.toml','.js','.css','.html','.pyc','.exe','.dll','.pyd','.pyz','.dylib','.so','') and PRIVATE.search(p.read_bytes()):errors.append('Private path '+name)
    source=resources/'GaiaGIS-source.zip'
    if source.is_file():
        with zipfile.ZipFile(source) as z:
            for n in z.namelist():
                if n.startswith(('tests/','output/','.cache/')) or n.startswith('web/public/data/') and n!='web/public/data/README.md' or Path(n).suffix.lower() in FORBIDDEN:errors.append('Forbidden source '+n)
                if Path(n).suffix.lower() in ('.py','.ts','.tsx','.txt','.md','.toml','.json','.sh','.ps1','.yml') and PRIVATE.search(z.read(n)):errors.append('Private source path '+n)
    # The EXE contains compressed bytecode; scanning its surface bytes is insufficient.
    # Builder uses the pinned PyInstaller reader to inspect every module without executing it.
    modules=0
    try:
        from PyInstaller.archive.readers import CArchiveReader
    except ImportError:
        errors.append('Deep audit requires the pinned packaging environment')
    else:
        if exe.is_file():
            archive=CArchiveReader(str(exe));pyz=archive.open_embedded_archive('PYZ.pyz')
            def inspect_code(code,name):
                if not isinstance(code,types.CodeType):return
                if PRIVATE.search(code.co_filename.encode()):errors.append('Private code filename '+name)
                for value in code.co_consts:
                    if isinstance(value,types.CodeType):inspect_code(value,name)
                    elif isinstance(value,(str,bytes)) and PRIVATE.search(value.encode() if isinstance(value,str) else value):errors.append('Private bytecode constant '+name)
            for name in pyz.toc:
                if name.startswith(('gaiagis.climate','gaiagis.orientation','scripts.','tools.')):errors.append('Unneeded sealed/developer module '+name)
                inspect_code(pyz.extract(name),name);modules+=1
            for name,entry in archive.toc.items():
                if entry[-1]=='s':inspect_code(marshal.loads(archive.extract(name)),name)
    print(json.dumps(dict(files=len(files),bytecode_modules=modules,proprietary_assets=0 if not errors else 'audit failed',errors=errors),indent=2))
    if errors:raise ValueError('Portable public audit failed')
    if target=='macos-arm64':mac_native_audit(root)
    return {'files':len(files),'proprietary_assets':0,'errors':[]}
if __name__=='__main__':audit(sys.argv[1])
