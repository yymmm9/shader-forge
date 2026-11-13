# Video→GLSL 复刻流程与还原度手册（Ink preset）

本文档沉淀 gokayfem「Video 2 GLSL」工作流在 shader-forge 的复刻方法：
把一段真实视频重建成**单个自包含片元 shader**（无纹理、纯数学、无缝循环），
以及三轮还原度迭代中验证过的「怎么改才更像」的具体手法。

- 源视频：Wikimedia Commons `File:Ink drops in water.ogv`（CC，1920×1080 Theora），截取 58–74s 水墨扩散稳态段，`cropdetect` 得 608×1024 竖幅内容区（x=656,y=6），等比缩到 304×512 做并排对比基准
- 产物：`public/shaders/ink-in-water.frag`（Shadertoy `mainImage` 约定）+ `src/app/shader/shader-effects.ts` 内嵌 `ink` preset（effect 22），两侧结构一一对应
- 对比物料：`compare-v3.mp4`（左实拍 16s 右 shader）、`comparison-grid-v3.png`（58s/66s/74s 三时点并排）、`comparison-still-v3.png`

## 复刻管线（可复用步骤）

1. **取段**：yt-dlp 下载源片 → ffmpeg `-ss/-t` 截取动作稳态段 → `cropdetect` 找内容区 → `crop+scale` 抽关键帧（每 2s 一帧做形态分析，fps=8 抽全段做对比视频）
2. **形态拆解**：逐帧读图，把场景拆成「密度层」——每层一个函数，最后 `d = Σ gain_i × layer_i`，经 Beer 吸收 `1-exp(-k·d)` 映射到墨色
3. **离线迭代**：headless Chrome + SwiftShader 渲 shader → ffmpeg `hstack` 与原帧并排 → 人眼逐项对比 → 改参数/结构 → 重复（本轮 7 版）
4. **双端同步**：独立 .frag 用 shader-skills 库原语（gradientNoise/fbm/ridgedFbm/billowFbm/curlNoise）；app 版用自带 valueNoise 系原语（inkFbmS/inkRidged/inkBillow）逐层移植，结构相同、形态近似非像素一致
5. **无缝循环**：所有时间项写为 `a = TAU·fract(t/LOOP)` 的周期函数；噪声演化走 2D `orbit()` 圆路径（噪声输入点绕圈不漂移），渲染 t=0 与 t=LOOP−ε 做差值验证（mean diff <1/255）

## 还原度对照清单（本轮实测有效的手法）

对着原帧逐项找差距时，按这四问拆：**形态结构 / 运动节律 / 色彩分布 / 颗粒层次**。

| 差距 | 修法 | 本轮验证 |
|---|---|---|
| 一个大黑团盖满画面，无内部结构 | 墨团内部换成**高对比纤维网**（ridged fbm smoothstep 出明暗交替丝缕），黑芯只留在被墨柱喂入的顶部（coreMask 按 d.y 限制），剪影用低频 fbm+ridged 扰动 + min() 合并双瓣做出菜花底缘 | plume 从实心黑块变成透光的纤维团 |
| 「发丝」渲成碎点/短线段 | 发丝是**连续长丝**，不是噪声颗粒：改显式「轨道法」——每条线 `x = lane(y,t)` 用低频 fbm 游走，细 tube + 蕾丝 margin；且每根丝只在一段 y 区间存活 | threads() 6 根限定 y-range 的挂丝 |
| 全局均匀的网状噪声 | 缠丝残留是**区域性的**：fbm 零等值线 `smoothstep(ε,0,|f|)` 出连续闭环曲线，但必须套软边界 mask（`length((p-c)/r)<1`）限制在墨团周围/左下残留区，否则全帧糊成毛线球 | cloudWeb() 三处 mask 区域 |
| 顶部一整条黑幕 | 顶部挂墨只在**入墨泳道处**厚：edge 高度场 × lace 撕裂下缘 × 按泳道 x 的权重衰减 | topRag() 三条 lane 加权 |
| 全画面一种墨色 | 参考视频有**两套墨色**：主黑墨 + 右侧一条明显偏褐（sepia）的分枝墨柱。密度分两个累加器 dB/dS，先渲 sepia 层再叠黑墨层 | inkSepiaTrail + 分段 Beer 上色 |
| 时间轴上永远长得一样 | 大形体要有**生命周期**：墨团 grow 用 `smoothstep` 化的正弦门控，循环开头几乎无墨团、中段盛放、尾段沉降，喂它的墨柱也随 grow 淡入淡出 | grow 门控 plume + trunk |
| 轨道边缘太「画出来的」 | 水墨边缘是扩散羽化：tube 内侧实心、外侧 `w*2.6` 倍宽的 ridged 纹理 margin，margin 密度随 threshold 起伏形成撕边 | trailLane 双层边缘 |
| 中灰区域死白/死灰 | 背景水体 + 大尺度低频帘幕 wash（线性响应不取阈值，取阈值就出细胞纹）+ 左重右轻偏置（墨水积多的一侧更浑） | veils() leftBias |
| 并排对不上节奏 | 先渲「单元素 solo 图」确认每层剪影成立再合层——合层后看不出谁拖后腿 | ink-plume-solo 调试法 |

## 排过的坑

- `ridgedFbm` 高阈值筛出的是**连续网状边**不是孤立丝——丝缕要么用 fbm 等值线、要么显式轨道
- `billow` 细胞纹当裙边/背景会糊满全帧——大尺度 wash 必须线性响应
- 丝/柱太多会变「平行竖条窗帘」——真实参考里丝缕稀疏且分区域，宁少勿滥
- 各层密度量级要拉开层次：墨团 ≫ 墨柱 > 缠丝网 > 帘幕，同级密度会互相淹没剪影

## 已知风格化取舍

- 参考的墨柱表面更「糙」，本实现偏「毛」；墨团比实拍更透光——属程序化噪声的固有风格差
- app 版与独立 .frag 噪声族不同（valueNoise vs gradientNoise），形态近似非像素一致，调参需双处同步
