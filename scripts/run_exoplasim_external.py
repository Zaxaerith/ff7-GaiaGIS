# SPDX-License-Identifier: GPL-3.0-only
"""Future external Linux/WSL workflow, separate ExoPlaSim installation required."""
import argparse,json,os,re,sys
from pathlib import Path
parser=argparse.ArgumentParser();parser.add_argument('configuration',type=Path);parser.add_argument('--years',type=int,default=1);parser.add_argument('--aquaplanet-smoke',action='store_true');parser.add_argument('--run-name');args=parser.parse_args()
root=Path(__file__).resolve().parents[1];cfg_path=args.configuration.resolve()
if not cfg_path.is_relative_to(root/'output/climate_v2/gcm'):raise SystemExit('Configuration and all GCM outputs must remain in workspace output/climate_v2/gcm')
if os.name=='nt':raise SystemExit('GCM validation pending: run in a separately prepared supported Linux/WSL environment; native Windows execution is unsupported')
if args.years<1:raise SystemExit('--years must be positive')
sys.dont_write_bytecode=True
temporary=root/'output/climate_v2/gcm/tmp';temporary.mkdir(parents=True,exist_ok=True)
for name in ['TMPDIR','TEMP','TMP']:os.environ[name]=str(temporary)
import exoplasim # External GPL-2.0 model; not vendored or combined with GaiaGIS sources.
if not Path(exoplasim.__file__).resolve().is_relative_to(root):
    raise SystemExit('External ExoPlaSim runtime must be separately installed under this workspace, because upstream auto-compilation can write into its package directory')
cfg=json.loads(cfg_path.read_text());directory=cfg_path.parent;options=cfg['configure']
run_name=args.run_name or ('aquaplanet-smoke' if args.aquaplanet_smoke else 'gaia')
if not re.fullmatch(r'[A-Za-z0-9_-]+',run_name):raise SystemExit('Invalid run name')
run_root=(directory/run_name).resolve()
if not run_root.is_relative_to(root/'output/climate_v2/gcm'):raise SystemExit('Run escaped GCM workspace')
if run_root.exists():raise SystemExit('Run already exists; use a new --run-name to preserve prior smoke/results')
run_root.mkdir()
if args.aquaplanet_smoke:
    options.pop('landmap',None);options.pop('topomap',None);options['aquaplanet']=True
else:
    for name in ['landmap','topomap']:options[name]=str(directory/options[name])
model=exoplasim.Model(resolution=cfg['resolution'],layers=cfg['layers'],ncpus=cfg['ncpus'],workdir=str(run_root/'external-run'),modelname='GaiaClimate',outputtype=cfg['outputtype'])
model.configure(**options);model.exportcfg();model.run(years=args.years,crashifbroken=True)
model.finalize(str(run_root/'external-results'),allyears=True,keeprestarts=True,clean=False)
