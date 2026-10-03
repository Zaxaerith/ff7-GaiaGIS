# Gaia V2 research entry point

**Level A completed / GCM validation pending.** 当前 baseline 推荐保持 V1 纬度；不是已经确定的物理 Gaia。Web Viewer 本轮未修改。

- [物理依据与来源](physical-basis.md)：FF7 evidence、Earth physics、Gaia assumptions 分开。
- [模型与运行方式](model-design.md)：方程、参数化、网格、产品精度和 CLI。
- [纬度搜索](latitude-optimization.md)：单调 PCHIP、regularization、评分与候选约束。
- [GCM 状态](gcm-validation.md)：平台证据、SRA 接口与未来独立运行。
- [实际结果](v2-results.md)：六方案、54 次敏感性、冲突、测试和 before/after hashes。

新增代码：`src/gaiagis/climate/`；配置：`config/climate/`；研究来源：`research/climate/`；输出：`output/climate_v2/`（gitignored）。运行脚本为 `scripts/climate_v2.py`，完整回归日志仅写 V2。原始 FF7 dataset 始终只读，不包含游戏二进制资产。
