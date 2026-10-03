# SPDX-License-Identifier: GPL-3.0-only
"""Local compiler smoke + supported-platform preflight, never a fake GCM result."""
import json,os,platform,shutil,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'output/climate_v2/gcm';OUT.mkdir(parents=True,exist_ok=True)
temporary=OUT/'tmp';temporary.mkdir(exist_ok=True)
for name in ['TMPDIR','TEMP','TMP']:os.environ[name]=str(temporary)
result={'platform':platform.platform(),'tools':{n:shutil.which(n) for n in ['gcc','g++','gfortran','bash','wsl']},'exoplasim_model_executed':False,'gcm_status':'GCM validation pending'}
compiler=result['tools']['gfortran']
if compiler:
    source=OUT/'fortran_smoke.f90';source.write_text('program smoke\n implicit none\n real(8) :: x(3)\n x=[1d0,2d0,3d0]\n print *, sum(x)\nend program smoke\n',encoding='ascii')
    compiled=subprocess.run([compiler,str(source),'-o',str(OUT/'fortran_smoke.exe')],cwd=OUT,capture_output=True,text=True)
    result['fortran_compile']={'returncode':compiled.returncode,'stderr':compiled.stderr}
    if compiled.returncode==0:
        run=subprocess.run([str(OUT/'fortran_smoke.exe')],cwd=OUT,capture_output=True,text=True)
        result['fortran_smoke']={'returncode':run.returncode,'stdout':run.stdout,'stderr':run.stderr}
if result['tools']['wsl']:
    probe=subprocess.run(['wsl','--list','--quiet'],cwd=OUT,capture_output=True)
    def decode(b):
        if b'\0' in b:return b.decode('utf-16-le')
        try:return b.decode('utf-8')
        except UnicodeDecodeError:return b.decode('gb18030')
    result['wsl_probe']={'returncode':probe.returncode,'stdout':decode(probe.stdout),'stderr':decode(probe.stderr)}
result['reason']='Upstream documents Windows via WSL. WSL is not installed/usable here; native MinGW Fortran alone is not a supported ExoPlaSim runtime. No system toolchain changes or external model installation performed.'
(OUT/'preflight.json').write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n',encoding='utf-8');print(json.dumps(result,indent=2,ensure_ascii=False))
