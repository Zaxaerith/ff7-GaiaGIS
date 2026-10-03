# Level B：GCM validation pending

**ExoPlaSim model executed: NO。没有 GCM 气候输出。Level A/GCM 一致性：UNKNOWN。**

核对了[官方文档](https://exoplasim.readthedocs.io/en/latest/index.html)与[API](https://exoplasim.readthedocs.io/en/latest/source/exoplasim.html)（3.4.2）。Windows 路径依赖 WSL；当前 `wsl --list --quiet` 返回子系统未安装，bash 不存在。已有 MinGW gfortran/gcc 编译并运行简单 Fortran 程序输出 6.0，仅为 **compiler smoke**，不是 GCM smoke。

未安装或更改 WSL、Linux、工具链或 ExoPlaSim。证据为 `output/climate_v2/gcm/preflight.json`。依用户允许的 fallback 完成 Level A；GCM smoke 与 shortlist GCM comparison 均 pending。

## 六套输入

每个 shortlist 目录保存 fractional boundary NetCDF、land mask SRA code 172、topography SRA code 129 与独立 JSON 参数。网格为 T21 32×64 Gaussian；SRA 北向南、经度从 0°依次递增 5.625°，writer 根据[官方格式](https://exoplasim.readthedocs.io/en/latest/_modules/exoplasim/randomcontinents.html#writeSRA)独立实现八整数 header 与每行八浮点数。

landmask 由 fractional land≥0.5 得到；topography 用**陆地条件平均高度×重力（m²/s²）**，海洋零。NetCDF 保存原 fractional 输入和米单位高度。保守 remap 使用周期经度区间，避免漏 seam 半格。SRA 读回与 NetCDF 数值、方位、单位自动对照；这不代表 GCM runtime 已接受文件。Binary threshold 会改变小岛和海岸，仍须 GCM 阶段核查。

JSON 核对了官方参数单位，并标为 runtime_verified=false；radius 用接口 Earth-radius 6371000 m 换算，pressure/pCO2 为 bar，rotationperiod/year 为 day。未输入 WM2，海洋为 slab。

## 支持环境中的后续流程

外部模型在工作区内的独立环境中准备（例如 gitignored `local_data/climate_runtime/`），GPL-2.0 源码不合并 GaiaGIS。上游首次实例化可能在 package 目录自动编译，因此脚本拒绝使用工作区之外的 ExoPlaSim 安装；所有运行和临时输出仍在工作区挂载路径。参考启动方式：

```bash
cd /mnt/d/Project/FF7Gaia
export TMPDIR=/mnt/d/Project/FF7Gaia/output/climate_v2/gcm/tmp
mkdir -p "$TMPDIR"
python -B scripts/run_exoplasim_external.py \
  output/climate_v2/gcm/v1_baseline/exoplasim-config.json \
  --aquaplanet-smoke --years 1
```

脚本 API 已查阅但未实际执行。先跑 1–5 年 aquaplanet，检查编译、退出、输出、重启、温度和 TOA 漂移；再在独立 run 中跑 Gaia 并核查地形方位和单位。脚本分别建立 aquaplanet-smoke/gaia 子目录，拒绝覆盖已存在 run；可用新的 --run-name 保存另一次实验。短 smoke 不是平衡气候。只有长期温度/TOA 漂移稳定后，才取一致季节窗口、多年 monthly climatology，按统一 scoring 与 distortion 比较 shortlist。保存模型版本、编译选项、年数、轨迹和边界 hash。

上游[许可证](https://github.com/alphaparrot/ExoPlaSim/blob/master/LICENSE.TXT)为 GPL-2.0。源码、二进制均未复制或重许可；未来与项目 GPL-3.0-only 的组合发布必须另行审查。格式参考不等于取得上游资产分发权。
