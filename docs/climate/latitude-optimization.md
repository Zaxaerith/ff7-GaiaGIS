# 纬度搜索与可识别性

唯一未知函数 φ=f(u)，u=game_north/H；经度、东西关系与 FF7 topology 不改变。沿用 V1 朝向，u 增大纬度严格下降。V1 精确控制为 `atan(sinh(2π(H/W)(0.5-u)))`，不是有限锚点近似。

其他候选使用七个等间距 u 点的 decreasing PCHIP。种子 20261002，边界绝对纬度 70–85°，内部锚点相对 V1 的随机扰动尺度 14°；保存所有提案与拒绝原因。64 个计算候选包含 V1+63 PCHIP，没有逐地区 warp 或逐 terrain anchor。

各段二次导数多项式检查严格下降；相对 V1 局部 stretch 要在 0.35–2.6，曲率最大 3500 deg/u²。stretch 与曲率另在 4097 点采样，不是曲率界的符号证明。stretch 仅为纬度方向导数比，不是全二维面积/Tissot distortion。

固定目标：

`J=1-C+0.18(RMS纬度差/10°)+0.14 RMS(log导数比)+0.02(curvature_RMS/1000)+0.10 max(cap_fraction-0.02,0)`。

J 越低越好。曲率为绝对曲率，故 V1 有小的非零曲率成本；偏离/stretch 成本为零。权重是工程研究假设，不是物理定律。极帽面积由 source 两侧纬度推导，无人工极地陆地。

## Soft evidence

先运行气候，再评分。TOML 权重：Snow/Jungle/Desert=3，Swamp=1.5，Forest=1，Grass/Wasteland=0.25。Mountain/Northern Cave/region 名称不计分。

Snow 偏好最热月≤10°C 与≥3 雪月；Jungle 最冷月≥15°C、年 P≥1500 mm、干月≤3、少雪；Desert AI≤0.5，Swamp AI≥0.8，Forest AI≥0.5 且最热月≥10°C，Grass 较弱温湿条件，Wasteland 偏干。**这是 calibration hypotheses，不是 FF7 气候观测。**

温度/年 P/AI 使用 sigmoid，尺度 5°C/500 mm/0.15或0.2；Jungle 多余干月 exp 衰减尺度三个月，干月暂作 P<60 mm。Snow 两项各半，Jungle 多条件相乘。该干月阈值不能普遍代表全部气候。

类内使用固定 V1 球面 chord-triangle 面积，跨类按 evidence weight 归一化。固定面积防止压缩某类面积作弊，不是精确测地面积。matched_fraction 为固定面积中 score≥0.5 的比例，不是物理验证通过率。

## 分辨率与不确定性

64 个候选在 5° 搜索；六个彼此 RMS 差≥3°的代表（含 V1）在 2.5° 复算。Shortlist 涵盖综合 J、最高 C、低变形及较对称/不对称方案；Pareto 仅使用 C 与 RMS 两维，不能等同完整 J。推荐仅为 shortlist 的最小 J，并非连续参数空间全局最优。

六方案×九场景=54 次 5° 敏感性计算：baseline，高度 0.5/2，倾角 22/25°，CO₂ 280/800 ppm，slab 20/100 m。未做风、水文、权重或 GCM 结构敏感性。沿海、小岛和高山的分辨率误差可能影响得分。

推荐允许回到 V1：独立 V2 气候产品已经形成，但现有证据可能不足以支持纬度改变。不能降低 regularization 或重设 Jungle 纬度来制造胜者。较高气候分、更大变形的替代方案留给后续研究，不设为 canon。
