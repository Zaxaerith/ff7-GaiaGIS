# Gaia V2.2 — Earth Gate Hardening

本阶段已完成 Earth-only 诊断与输入面敏感性研究。完整 gate 仍失败；180 个 Gaia scenarios 保持 `not_run_earth_gate_failed`。未更改 Web、纬度候选、V1/V2/V2.1 产品或 FF7 文件。

主报告：[validation-report.md](validation-report.md)。预先声明的设计：[validation-design.md](validation-design.md)。声明文件保持原始字节，实际执行的细节与勘误在主报告中说明。

在 `D:\Project\FF7Gaia` 使用现有 Windows native QGIS Python 3.12+，不安装运行环境。顺序：

```powershell
python -B scripts/climate_v22.py pet
python -B scripts/climate_v22.py soil
python -B scripts/climate_v22.py soil-fix
python -B scripts/climate_v22.py precipitation
python -B scripts/climate_v22.py overlap
python -B scripts/climate_v22.py gate
python -B scripts/climate_v22.py test
python -B scripts/climate_v22_safety.py check
python -B scripts/climate_v22.py report
```

`pet` 首次获取四份 NOAA PSL 小型公开 climatology，其后直接读本地文件；所有临时文件、缓存和结果位于 `output/climate_v22/`。`overlap` 在完整原始 WM0 base geometry 上运行，耗时比单元测试长。`soil-fix` 只对经过逐格证明的 PET 饱和净输入格点解析求解相同 bucket 方程，不是参数调优或追加 spinup。

已有 `frozen-originals.json` 禁止重建。安全检查覆盖 530 个冻结文件及 7 个 FF7 输入 fingerprint。运行所有阶段后才运行完整测试，因为部分回归检查验证真实产物。全部原有 116 个测试保留；不跳过测试。

运行时可设置 `GAIAGIS_QGIS_ROOT` 指向现有 QGIS 安装。解析、物理模型与 GUI 无关；此启动器只是复用已安装的 NumPy/SciPy/GDAL/Shapely。没有 WSL、GCM 或系统工具链探测。

三个 surface policies 是研究假设。暂建议下一阶段以 `natural_priority` 作为气候自然地表研究主方案，同时保留 highest/lowest 敏感性范围；本阶段不确立唯一 canonical surface。局部差异很大，不能因全球面积差异小而忽略重叠。

新增代码以 GPL-3.0-only 发布。V22 model/area integration 是本项目自有 V21 代码的隔离派生实现；未复制无明确许可证的 FF7 反编译或 Landscaper 源码。NOAA 原始输入、派生结果与游戏资产均不进入 Git。
