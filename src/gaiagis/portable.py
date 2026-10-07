"""Windows portable entry point; data roots are the extracted package directory."""
# SPDX-License-Identifier: GPL-3.0-only
import hashlib
import json
from pathlib import Path
import sys
from .safety import WORKSPACE_ROOT, output_path
from ._version import __version__

def verified_viewer():
    root=output_path(WORKSPACE_ROOT/'web/dist-release')
    inventory=json.loads((WORKSPACE_ROOT/'portable-manifest.json').read_text(encoding='utf8'))
    if inventory.get('schema')!='gaiagis-portable' or inventory.get('version')!=1:raise ValueError('Invalid portable manifest')
    records=inventory.get('viewer',{})
    actual={p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file()}
    if not isinstance(records,dict) or set(records)!=actual or 'index.html' not in actual:raise ValueError('Viewer inventory mismatch')
    for name,digest in records.items():
        path=output_path(root/name)
        if not path.is_relative_to(root) or hashlib.sha256(path.read_bytes()).hexdigest()!=digest:raise ValueError('Viewer integrity failure')
    return root

def main():
    if '--self-test' in sys.argv:
        from . import portable_stage, native_workspace
        from .atlas import curated_hash
        from .reconstruction import read_config
        verified_viewer();read_config(WORKSPACE_ROOT/'config/default.toml');curated_hash()
        import tkinter as tk
        from tkinter import filedialog
        window=tk.Tk();window.withdraw();tcl_library=window.tk.eval('info library');window.destroy()
        print(json.dumps({'frozen':bool(getattr(sys,'frozen',False)),'version':__version__,'python':sys.version.split()[0],'viewer':'verified','chooser':'tk-runtime-verified','tcl_library':tcl_library,'runtime':str(Path(sys._MEIPASS)) if hasattr(sys,'_MEIPASS') else 'source','external_python_required':False,'node_required':False}))
        return 0
    # Reuse unchanged localhost security/allowlists; never expose filesystem chooser via HTTP.
    if '--source' not in sys.argv[1:]:
        import tkinter as tk
        from tkinter import filedialog
        window=tk.Tk();window.withdraw()
        source=filedialog.askdirectory(parent=window,title='GaiaGIS — Select your read-only FF7 installation')
        window.destroy()
        if not source:return 0
        sys.argv.extend(['--source',source])
    from .local import main as local_main
    return local_main(sys.argv[1:])
