"""Windows portable entry point; data roots are the extracted package directory."""
# SPDX-License-Identifier: GPL-3.0-only
import hashlib
import json
from pathlib import Path
import sys
import shutil
import queue
import threading
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

def launch_preflight():
    """Portable data stays beside the executable, in a writable extracted folder."""
    probe=output_path(WORKSPACE_ROOT/'.gaiagis-write-check')
    try:
        with probe.open('xb') as stream:stream.write(b'')
        probe.unlink()
    except OSError as error:
        raise PermissionError('Extract the entire ZIP to a writable folder, then run GaiaGIS.exe there. '+str(error)) from error
    # Cold generation needs room for intermediate and final packs. No install manager.
    if not (WORKSPACE_ROOT/'output/local-workspace/gaia-workspace.json').is_file() and shutil.disk_usage(WORKSPACE_ROOT).free<256*1024*1024:
        raise OSError('At least 256 MB of free space is needed for the first build. Move the extracted folder to a drive with more free space.')


def launch_window():
    """One small native startup window; parsing/building remain in existing owners."""
    import tkinter as tk
    from tkinter import ttk, filedialog
    from .local import main as local_main, CONFIG
    messages={
        'title':('Start GaiaGIS','启动 GaiaGIS','啟動 GaiaGIS','GaiaGIS を起動','GaiaGIS 시작'),
        'hint':('Select your original FF7 installation. Game files are only read. Generated data stays beside GaiaGIS.exe.','选择原版 FF7 安装目录。游戏文件只读；生成数据保存在 GaiaGIS.exe 所在目录。','選擇原版 FF7 安裝目錄。遊戲檔案唯讀；產生資料保存在 GaiaGIS.exe 所在目錄。','オリジナル版 FF7 のインストール先を選択。ゲームは読み取り専用で、生成データは EXE の隣に保存します。','원본 FF7 설치 폴더를 선택하세요. 게임은 읽기 전용이며 생성 데이터는 EXE 옆에 저장됩니다.'),
        'choose':('Choose FF7 folder','选择 FF7 目录','選擇 FF7 目錄','FF7 フォルダーを選択','FF7 폴더 선택'),
        'start':('Start / Retry','启动／重试','啟動／重試','起動 / 再試行','시작 / 다시 시도'),
        'checking':('Checking installation…','正在检查安装目录…','正在檢查安裝目錄…','インストールを確認中…','설치 확인 중…'),
        'building':('Preparing resources','正在准备资源','正在準備資源','リソースを準備中','리소스 준비 중'),
        'ready':('Viewer ready. Keep this window open while playing with GaiaGIS.','Viewer 已就绪。使用 GaiaGIS 时请保持本窗口打开。','Viewer 已就緒。使用 GaiaGIS 時請保持本視窗開啟。','Viewer の準備完了。使用中はこのウィンドウを開いたままにしてください。','Viewer 준비 완료. GaiaGIS 사용 중 이 창을 열어 두세요.'),
        'failed':('Could not start. Check the details below, select the correct original-game folder and retry.','启动失败。请查看下方详情，选择正确的原版游戏目录后重试。','啟動失敗。請查看下方詳情，選擇正確的原版遊戲目錄後重試。','起動できません。下の詳細を確認し、正しい原作のフォルダーを選び再試行してください。','시작하지 못했습니다. 아래 내용을 확인하고 올바른 원본 게임 폴더로 다시 시도하세요.'),
        'stop':('Close / Stop','关闭／停止','關閉／停止','閉じる / 停止','닫기 / 중지'),
        'cancel':('Cancel after current resource','当前资源完成后取消','目前資源完成後取消','現在のリソース完了後に中止','현재 리소스 완료 후 취소'),
    }
    window=tk.Tk();window.title('GaiaGIS '+__version__);window.geometry('600x390');window.minsize(420,340)
    language=ttk.Combobox(window,values=['English','简体中文','繁體中文','日本語','한국어'],state='readonly',width=18);language.current(0);language.pack(anchor='e',padx=16,pady=8)
    frame=ttk.Frame(window,padding=16);frame.pack(fill='both',expand=True)
    hint=ttk.Label(frame,wraplength=550);hint.pack(fill='x')
    source=tk.StringVar();ttk.Entry(frame,textvariable=source).pack(fill='x',pady=12)
    buttons=ttk.Frame(frame);buttons.pack(fill='x')
    status=tk.StringVar();status_label=ttk.Label(frame,textvariable=status,wraplength=550);status_label.pack(fill='x',pady=12)
    bar=ttk.Progressbar(frame,maximum=15);bar.pack(fill='x')
    details=tk.Text(frame,height=4,wrap='word',state='disabled');details.pack(fill='both',expand=True,pady=8)
    events=queue.Queue();cancel=threading.Event();worker=None;server=None;last_state='checking';last_detail='';close_pending=False
    def text(key):return messages[key][language.current()]
    def refresh():
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
            launch_preflight()
            code=local_main(['--source',selected_source,'--remember-source'],progress=progress,ready=ready)
            events.put(('done',code))
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
    window.bind('<Configure>',lambda e:(hint.configure(wraplength=max(280,e.width-32)),status_label.configure(wraplength=max(280,e.width-32))) if e.widget is window else None)
    try:
        value=json.loads(CONFIG.read_text(encoding='utf8')).get('source')
        if isinstance(value,str):source.set(value)
    except (OSError,ValueError,AttributeError):pass
    refresh();poll()
    if source.get():window.after(200,begin)
    window.mainloop();return 0


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
    if not sys.argv[1:]:return launch_window()
    from .local import main as local_main
    return local_main(sys.argv[1:])
