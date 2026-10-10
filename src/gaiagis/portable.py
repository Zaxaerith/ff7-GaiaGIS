"""Native portable startup; Mac resources and writable workspaces are separate."""
# SPDX-License-Identifier: GPL-3.0-only
import hashlib
import json
from pathlib import Path
import sys
import shutil
import queue
import threading
import os
import platform
from .safety import WORKSPACE_ROOT, RESOURCE_ROOT, output_path, resource_path
from ._version import __version__

def verified_viewer():
    root=resource_path(RESOURCE_ROOT/'web/dist-release')
    inventory=json.loads(resource_path(RESOURCE_ROOT/'portable-manifest.json').read_text(encoding='utf8'))
    if inventory.get('schema')!='gaiagis-portable' or inventory.get('version')!=1 or inventory.get('tool_version')!=__version__:raise ValueError('Invalid portable manifest')
    records=inventory.get('viewer',{})
    actual={p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file()}
    if not isinstance(records,dict) or set(records)!=actual or 'index.html' not in actual:raise ValueError('Viewer inventory mismatch')
    for name,digest in records.items():
        path=resource_path(root/name)
        if not path.is_relative_to(root) or hashlib.sha256(path.read_bytes()).hexdigest()!=digest:raise ValueError('Viewer integrity failure')
    return root

def launch_preflight():
    """Probe only the authorized workspace, never the macOS application bundle."""
    output_path(WORKSPACE_ROOT).mkdir(parents=True,exist_ok=True)
    probe=output_path(WORKSPACE_ROOT/'.gaiagis-write-check')
    try:
        with probe.open('xb') as stream:stream.write(b'')
        probe.unlink()
    except OSError as error:
        advice='Choose a writable GAIAGIS_WORKSPACE_ROOT outside GaiaGIS.app.' if sys.platform=='darwin' else 'Extract the entire ZIP to a writable folder, then run GaiaGIS.exe there.'
        raise PermissionError(advice+' '+str(error)) from error
    # Cold generation needs room for intermediate and final packs. No install manager.
    if not (WORKSPACE_ROOT/'output/local-workspace/gaia-workspace.json').is_file() and shutil.disk_usage(WORKSPACE_ROOT).free<256*1024*1024:
        raise OSError('At least 256 MB of free space is needed in the GaiaGIS workspace for the first build.')


def launch_window():
    """One small native startup window; parsing/building remain in existing owners."""
    import tkinter as tk
    from tkinter import ttk, filedialog
    from .local import main as local_main, CONFIG
    messages={
        'title':('Start GaiaGIS','启动 GaiaGIS','啟動 GaiaGIS','GaiaGIS を起動','GaiaGIS 시작'),
        'hint':('Select your original FF7 PC data folder. Game files are only read.','选择原版 FF7 PC 数据目录。游戏文件只读。','選擇原版 FF7 PC 資料目錄。遊戲檔案唯讀。','オリジナル版 FF7 PC データを選択。ゲームは読み取り専用です。','원본 FF7 PC 데이터 폴더를 선택하세요. 게임 파일은 읽기 전용입니다.'),
        'workspace':('GaiaGIS workspace','GaiaGIS 工作区','GaiaGIS 工作區','GaiaGIS ワークスペース','GaiaGIS 작업 공간'),
        'choose':('Choose FF7 folder','选择 FF7 目录','選擇 FF7 目錄','FF7 フォルダーを選択','FF7 폴더 선택'),
        'start':('Start / Retry','启动／重试','啟動／重試','起動 / 再試行','시작 / 다시 시도'),
        'checking':('Checking installation…','正在检查安装目录…','正在檢查安裝目錄…','インストールを確認中…','설치 확인 중…'),
        'building':('Preparing resources','正在准备资源','正在準備資源','リソースを準備中','리소스 준비 중'),
        'ready':('Viewer ready. Keep this window open while playing with GaiaGIS.','Viewer 已就绪。使用 GaiaGIS 时请保持本窗口打开。','Viewer 已就緒。使用 GaiaGIS 時請保持本視窗開啟。','Viewer の準備完了。使用中はこのウィンドウを開いたままにしてください。','Viewer 준비 완료. GaiaGIS 사용 중 이 창을 열어 두세요.'),
        'failed':('Could not start. Check the details below, select the correct original-game folder and retry.','启动失败。请查看下方详情，选择正确的原版游戏目录后重试。','啟動失敗。請查看下方詳情，選擇正確的原版遊戲目錄後重試。','起動できません。下の詳細を確認し、正しい原作のフォルダーを選び再試行してください。','시작하지 못했습니다. 아래 내용을 확인하고 올바른 원본 게임 폴더로 다시 시도하세요.'),
        'stop':('Close / Stop','关闭／停止','關閉／停止','閉じる / 停止','닫기 / 중지'),
        'cancel':('Cancel after current resource','当前资源完成后取消','目前資源完成後取消','現在のリソース完了後に中止','현재 리소스 완료 후 취소'),
    }
    window=tk.Tk();window.title('GaiaGIS '+__version__);window.geometry('600x440');window.minsize(420,390)
    language=ttk.Combobox(window,values=['English','简体中文','繁體中文','日本語','한국어'],state='readonly',width=18);language.current(0);language.pack(anchor='e',padx=16,pady=8)
    frame=ttk.Frame(window,padding=16);frame.pack(fill='both',expand=True)
    hint=ttk.Label(frame,wraplength=550);hint.pack(fill='x')
    workspace_label=ttk.Label(frame,wraplength=550);workspace_label.pack(fill='x',pady=(8,0))
    source=tk.StringVar();ttk.Entry(frame,textvariable=source).pack(fill='x',pady=12)
    buttons=ttk.Frame(frame);buttons.pack(fill='x')
    status=tk.StringVar();status_label=ttk.Label(frame,textvariable=status,wraplength=550);status_label.pack(fill='x',pady=12)
    bar=ttk.Progressbar(frame,maximum=15);bar.pack(fill='x')
    details=tk.Text(frame,height=4,wrap='word',state='disabled');details.pack(fill='both',expand=True,pady=8)
    events=queue.Queue();cancel=threading.Event();worker=None;server=None;last_state='checking';last_detail='';close_pending=False
    def text(key):return messages[key][language.current()]
    def refresh():
        workspace_label.configure(text=text('workspace')+': '+str(WORKSPACE_ROOT))
        hint.configure(text=text('hint'));choose.configure(text=text('choose'));start.configure(text=text('start'));stop.configure(text=text('cancel') if worker and worker.is_alive() and not server else text('stop'));status.set(text(last_state)+(f' · {int(bar["value"])}/{int(bar["maximum"])}' if last_state=='building' else ''));
    def choose_folder():
        value=filedialog.askdirectory(parent=window,title=text('choose'))
        if value:source.set(value)
    def progress(label,done,total):
        if cancel.is_set() and not label.startswith('error:'):raise KeyboardInterrupt()
        events.put(('progress',(label,done,total)))
    def ready(value,url):events.put(('ready',(value,url)))
    def run(selected_source):
        try:
            from .safety import protect_input
            from .local import validate_source
            selected=Path(selected_source).resolve()
            if WORKSPACE_ROOT.is_relative_to(selected):raise ValueError('GaiaGIS workspace cannot be inside the selected game source')
            validate_source(selected)
            protect_input(selected_source)
            launch_preflight()
            code=local_main(['--source',selected_source,'--remember-source'],progress=progress,ready=ready)
            events.put(('done',code))
        except KeyboardInterrupt:events.put(('done',0))
        except Exception as error:events.put(('error',str(error)))
    def begin():
        nonlocal worker,last_state,last_detail
        if worker and worker.is_alive():return
        if not source.get():choose_folder()
        if not source.get():return
        cancel.clear();last_state='checking';last_detail='';bar['value']=0
        details.configure(state='normal');details.delete('1.0','end');details.configure(state='disabled')
        choose.configure(state='disabled');start.configure(state='disabled');refresh()
        worker=threading.Thread(target=run,args=(source.get(),),daemon=True);worker.start()
    def close():
        nonlocal close_pending
        close_pending=True;cancel.set()
        if server:threading.Thread(target=server.shutdown,daemon=True).start()
        elif not worker or not worker.is_alive():window.destroy()
        else:refresh()
    choose=ttk.Button(buttons,command=choose_folder);choose.pack(side='left');start=ttk.Button(buttons,command=begin);start.pack(side='left',padx=8);stop=ttk.Button(buttons,command=close);stop.pack(side='right')
    def poll():
        nonlocal server,last_state,last_detail
        while not events.empty():
            kind,value=events.get()
            if kind=='progress':
                label,done,total=value;last_state='checking' if label=='checking' else 'failed' if label.startswith('error:') else 'building';bar.configure(maximum=total,value=done);last_detail=label
            elif kind=='ready':
                server,url=value;last_state='ready';last_detail=url;bar['value']=bar['maximum']
                if close_pending:threading.Thread(target=server.shutdown,daemon=True).start()
            elif kind in ('done','error'):
                if close_pending:window.destroy();return
                last_state='failed' if kind=='error' or value else 'checking'
                if kind=='error':last_detail=value
                choose.configure(state='normal');start.configure(state='normal');server=None
            details.configure(state='normal');details.delete('1.0','end');details.insert('end',last_detail);details.configure(state='disabled');refresh()
        window.after(100,poll)
    language.bind('<<ComboboxSelected>>',lambda _:refresh());window.protocol('WM_DELETE_WINDOW',close)
    window.bind('<Configure>',lambda e:(hint.configure(wraplength=max(280,e.width-32)),workspace_label.configure(wraplength=max(280,e.width-32)),status_label.configure(wraplength=max(280,e.width-32))) if e.widget is window else None)
    try:
        value=json.loads(CONFIG.read_text(encoding='utf8')).get('source')
        if isinstance(value,str):source.set(value)
    except (OSError,ValueError,AttributeError):pass
    refresh();poll()
    if source.get():window.after(200,begin)
    window.mainloop();return 0


def write_report(path, value):
    target=output_path(Path(path))
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(value,sort_keys=True)+'\n',encoding='utf8')


def _main():
    args=sys.argv[1:]
    if '--self-test' in args:
        from . import portable_stage, native_workspace
        from .atlas import curated_hash
        from .reconstruction import read_config
        verified_viewer();read_config(resource_path(RESOURCE_ROOT/'config/default.toml'));curated_hash()
        import tkinter as tk
        from tkinter import filedialog
        window=tk.Tk();window.withdraw();tcl_library=window.tk.eval('info library');tk_library=window.tk.eval('set tk_library');window.destroy()
        result={'frozen':bool(getattr(sys,'frozen',False)),'version':__version__,'python':sys.version.split()[0],'architecture':platform.machine(),'viewer':'verified','chooser':'tk-runtime-verified','tcl_library':tcl_library,'tk_library':tk_library,'runtime':str(Path(sys._MEIPASS)) if hasattr(sys,'_MEIPASS') else 'source','resource_root':str(RESOURCE_ROOT),'workspace_root':str(WORKSPACE_ROOT),'external_python_required':False,'node_required':False}
        if '--report' in args:write_report(args[args.index('--report')+1],result)
        else:print(json.dumps(result))
        return 0
    # A bounded code-only fixture exercises the real frozen HTTP server in CI.
    # It is never used as evidence of real geometry generation or sent in a package.
    if '--smoke-server' in args:
        from .local import make_server
        from .build_workspace import write_manifest
        from .output_lifecycle import OutputRun
        with OutputRun('runtime') as job:
            root=job.path/'synthetic-workspace';root.mkdir()
            (root/'gaia-meta.json').write_text('{"smoke_fixture":true}',encoding='utf8')
            (root/'gaia-mesh.bin').write_bytes(b'synthetic portable HTTP smoke')
            write_manifest(root,{})
            with make_server(root,verified_viewer(),port=0) as server:
                write_report(args[args.index('--smoke-server')+1],{'url':f'http://127.0.0.1:{server.server_port}/','fixture':'synthetic HTTP only','workspace_path':str(root)})
                server.serve_forever(poll_interval=.2)
        return 0
    # Reuse unchanged localhost security/allowlists; never expose filesystem chooser via HTTP.
    if not args:return launch_window()
    from .local import main as local_main
    ready=None
    if '--ready-report' in args:
        index=args.index('--ready-report');report=args[index+1];del args[index:index+2]
        ready=lambda server,url:write_report(report,{'url':url,'workspace_path':str(WORKSPACE_ROOT/'output/local-workspace')})
    return local_main(args,ready=ready)


def main():
    """Windowed macOS bootloaders have no streams; keep one bounded private log."""
    if sys.platform!='darwin':return _main()
    from .safety import protect_input
    selected=sys.argv[sys.argv.index('--source')+1] if '--source' in sys.argv else None
    if selected is None:
        try:selected=json.loads((WORKSPACE_ROOT/'.gaiagis-local.json').read_text(encoding='utf8')).get('source')
        except (OSError,ValueError,AttributeError):pass
    if selected:protect_input(selected)
    log=None;streams=(sys.stdout,sys.stderr)
    try:
        from .output_lifecycle import OutputRun
        with OutputRun('launcher'):
            os.environ['PYTHONDONTWRITEBYTECODE']='1'
            if sys.stdout is None or sys.stderr is None:
                log=output_path(WORKSPACE_ROOT/'output/portable-startup.log').open('w',encoding='utf8')
                sys.stdout=sys.stderr=log
            return _main()
    except Exception as error:
        if log:
            import traceback
            traceback.print_exc()
        if not sys.argv[1:]:
            from tkinter import messagebox
            messagebox.showerror('GaiaGIS could not start',str(error))
        return 1
    finally:
        if log:
            sys.stdout,sys.stderr=streams
            log.close()
