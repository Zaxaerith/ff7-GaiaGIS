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

FORBIDDEN={'.ff7','.lgp','.map','.bot','.tex','.hrc','.rsd','.p','.a','.iso','.rom','.ct','.png','.jpg','.jpeg','.webp'}
PRIVATE=re.compile(rb'[A-Za-z]:[\\/](?:Users|SteamLibrary|MYAPPLICA|MYAPPLY|Project)[\\/]',re.I)
def audit(root):
    root=Path(root).resolve();files=[p for p in root.rglob('*') if p.is_file()];errors=[]
    required=['GaiaGIS.exe','LICENSE.txt','THIRD_PARTY_NOTICES.txt','README.txt','licenses/PYTHON.txt','licenses/PYINSTALLER.txt','licenses/TCL.txt','licenses/TK.txt','licenses/OPENSSL.txt','portable-manifest.json','GaiaGIS-source.zip','web/dist-release/index.html','config/default.toml']
    for n in required:
        if not (root/n).is_file():errors.append('Missing '+n)
    for p in files:
        name=p.relative_to(root).as_posix()
        if p.suffix.lower() in FORBIDDEN or any(x in Path(name).parts for x in ('output','.cache','tests','node_modules','local-workspace')) or p.name.startswith('gaia-') or p.name in ('gaia-workspace.json','local-launch.json','.gaiagis-local.json'):errors.append('Forbidden '+name)
        if p.suffix.lower() in ('.json','.txt','.toml','.js','.css','.html','.pyc','.exe','.dll','.pyd','.pyz') and PRIVATE.search(p.read_bytes()):errors.append('Private path '+name)
    source=root/'GaiaGIS-source.zip'
    if source.is_file():
        with zipfile.ZipFile(source) as z:
            for n in z.namelist():
                if n.startswith(('tests/','output/','.cache/')) or n.startswith('web/public/data/') and n!='web/public/data/README.md' or Path(n).suffix.lower() in FORBIDDEN:errors.append('Forbidden source '+n)
                if Path(n).suffix.lower() in ('.py','.ts','.txt','.md','.toml','.json') and PRIVATE.search(z.read(n)):errors.append('Private source path '+n)
    # The EXE contains compressed bytecode; scanning its surface bytes is insufficient.
    # Builder uses the pinned PyInstaller reader to inspect every module without executing it.
    modules=0
    try:
        from PyInstaller.archive.readers import CArchiveReader
    except ImportError:
        errors.append('Deep audit requires the pinned packaging environment')
    else:
        exe=root/'GaiaGIS.exe'
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
    return {'files':len(files),'proprietary_assets':0,'errors':[]}
if __name__=='__main__':audit(sys.argv[1])
