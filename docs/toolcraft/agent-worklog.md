# Toolcraft App Agent Worklog

## Status

Mode: product

Shader Forge 是一个文字/图片驱动的 shader 编辑器：把用户输入的文字或上传的图片栅格化为源纹理，用一张 WebGL2 全屏 fragment shader 施加 17 种循环动画效果，输出可交互预览并导出 PNG/JPG 静帧。

Active change: shader-forge-stg-effects

## Decision Trail

### Entry shader-forge-ascension-preset

- Change ID: shader-forge-ascension-preset
- Entry type: feature edit
- Request: "https://ascension.pegassi.be/ 复刻它hero的文字效果 应该是webgl做的 'ascension'"
- Task type: renderer feature — 复刻参考站封面 hero 字效为 strip-space fragment preset
- User-visible result: Effect preset 扩到 22 种，新增 `Ascension` —— 文字呈拱形排布的镀铬液态金属效果（锐利明暗条纹 + 虹彩边缘 + 熔边波动 + 淡蓝白外发光），持续无缝动画；文字与图片源均适用
- Source/reference checked: https://ascension.pegassi.be/ 线上站点 —— Playwright 截图确认整页为单一 WebGL2 canvas（自研引擎 + 字形曲线纹理 u_curves 渲染 DOM 文案）；hero 的 "ASCENSION" 实为专辑封面美术资产的一部分（封面为唱片 3D 场景纹理），其视觉语言：拱形排布、铬金属条纹填充、虹彩边缘、熔边、暗底颗粒
- Reference inputs: None — 参考为活站点视觉检查（截图对比），无视频素材；未注册 referenceInputs
- Docs/contracts read: 本轮为纯 fragment 分支新增，复用 shader-forge-stg-effects 已读的 strip-space/sampleStrip 契约；无新增控件与交互
- Contract rules applied: 新效果仅消费已声明 uniforms（u_band 经 sampleStrip）；无新增控件/交互；pipeline/acceptance 结构不变，仅 preset 枚举扩展
- View interaction intent: non-spatial — 仍为固定 2D 光栅输出
- Interaction ownership: 不变 — 效果选择与参数归 Effect 面板，播放归 Timeline
- Decision: `ascensionColor` —— strip 空间抛物线拱形（`su.y -= arch·(1-cx²)`）+ 多频正弦熔边扰动 + alpha 梯度（mx/my）驱动虹彩边缘色散（atan→cos 调色板）与条纹扭曲 + `pow(cos,3.5)` 锐利铬条纹 × 纵向明暗包络 + 源色 30% 染色（文字白色→纯铬，图片→按原色着铬）+ 四向 alpha 膨胀外发光；全部时间项为周期函数
- Alternatives rejected: 逐字形 3D 摆放 + 封面纹理复刻（参考站封面字本身是美术资产非程序化字效，真 3D 需 instanced renderer 与封面贴图系统，超出单 preset 范畴）；像素级复刻封面（含楼梯/人影图片内容，非文字效果）
- State/output mapping: effect.preset=21 → ascensionColor 分支；amount → 拱形幅度/熔边/虹彩/发光强度；scale → 铬条纹频率；phase/speed → 无缝循环相位
- Verification: `npx tsc --noEmit` 通过；聚焦测试 25 passed；Playwright 离屏 WebGL2 编译链接通过，effect 21 渲染 "ASCENSION" 238255 lit 像素，截图确认拱形铬字 + 虹彩边缘 + 外发光
- Risks:
  - Risk: bandH 固定 0.55 —— 字号极大时字形可能触碰拱形边缘裁剪带；文字源随 u_band 实测可再调
  - Risk: 参考站封面字含图片纹理细节（颗粒/划痕），本实现只取字体效果语言，颗粒感可叠加 Grain preset 思路但当前单 preset 不含

### Entry shader-forge-stg-effects

- Change ID: shader-forge-stg-effects
- Entry type: feature edit
- Request: "你可以参考 https://spacetypegenerator.com/ 如果可以先下载下来然后慢慢复刻成react的话更好了"
- Task type: renderer feature — port STG signature effects as strip-space UV remaps
- User-visible result: Effect preset 扩到 21 种，新增 Cylinder（文字环绕旋转圆柱、多环堆叠、背面镜像透显）、Flag（飘旗波浪 + 褶皱明暗）、Coil（侧视弹簧螺旋条带）、Stripes（竖条百叶窗波浪）；文字与图片源均适用
- Source/reference checked: spacetypegenerator.com 整站源码已下载到 ~/Documents/GitHub/stg-source（123 个 p5.js 文件）；sketch.js（cylinder）、sketch_flag.js、sketch_stripes.js 的核心几何（rotateY 环形摆放 + sinEngine 波形器 + per-glyph 3D transform）
- Reference inputs: None — 参考为活站点源码，无视频素材；未注册 referenceInputs
- Docs/contracts read: shader-text.ts/shader-source.ts/shader-gl.ts 纹理管线；STG 原作为 p5.js WEBGL 逐字形 3D 摆放，复刻路线为单纹理 UV 重映射近似（per-glyph 真 3D 需独立 instanced renderer，留作后续）
- Contract rules applied: 新效果仅消费已声明 uniform + 新增 u_band；无新增控件/交互；pipeline/acceptance 结构不变，仅 preset 枚举扩展
- View interaction intent: non-spatial — 仍为固定 2D 光栅输出
- Interaction ownership: 不变 — 效果选择与参数归 Effect 面板，播放归 Timeline
- Decision: 新增 `u_band` uniform（文字栅格的实际字形带高度占比，由 rasterizeShaderText 在宽度适配后计算 `(lines-1)*fittedLineHeight + fontSize*1.1`；图片源恒为 1）+ `sampleStrip` 采样器（strip 空间 → band 裁剪 → sourceTransform）→ 四个效果把 su.x 映射为 θ=asin(x/R)（cylinder 前后两面投影）或正弦条带（coil）或逐条位移（flag/stripes）
- Alternatives rejected: 逐字形 instanced 渲染（真 STG 3D 复刻需新 renderer pass，体量超出本轮）；固定 0.5 band 裁剪（短文本字形会超出裁剪带 —— 改为栅格化时实测回传）
- State/output mapping: u_band ← 文字栅格 band（descriptor → materialize → render params）；effect.preset 17–20 → 新 fragment 分支；amount/scale/phase/speed 复用既有语义
- Verification: `npx tsc --noEmit` 通过；Playwright 离屏 WebGL2 编译链接通过，effect 17–20 渲染像素数分别 51332/34499/10787/31911（coil 为细条带属预期）；聚焦测试全过
- Risks:
  - Risk: band 估算基于 fontSize 近似 em 高度，极端字体/描边可能轻微超出裁剪带
  - Risk: coil 条带较细，低分辨率/小画布上字形偏小

### Entry shader-forge-panel-actions

- Change ID: shader-forge-panel-actions
- Entry type: feature edit
- Request: "有点进展 但不多 再试试，不够酷 当然很多时候也要保持文字阅读方便 / 我需要randomize按钮 / 和复制参数按钮 这样可以给你存preset"
- Task type: sticky footer actions + shader preset expansion
- User-visible result: 底部操作栏新增 Randomize（随机 preset + 参数组合）与 Copy params（把当前配方 JSON 写入剪贴板）；Effect preset 扩到 17 种，新增 Liquid（domain-warp 彩虹流动）、Aura（边缘辉光）、Prism（边缘棱镜着色）三个以源亮度/alpha 为遮罩的可读性友好效果
- Source/reference checked: 无外部参考素材；参考 Figma/Framer shader 的方向由用户口述，实现为亮度遮罩 + cos 调色板 + fbm domain warp
- Reference inputs: None — 无动态参考素材；未注册 referenceInputs
- Docs/contracts read: controls-panel-actions.ts（panelActions 提升与合并语义）、control-acceptance-kind-rules.ts（footer 覆盖规则）、export-artifact-coverage.ts（typed export action 覆盖要求）、toolcraft-app-ports.ts（onPanelAction port）
- Contract rules applied: 产品 panelActions 声明在专用 actionGroup section，runtime 将其与 typed export action 合并为单一 footer 控件（target=首个声明的 actions.shader）；footer 覆盖 entry 列出全部 action value；typed export.png 的 exported-bytes 覆盖行保持独立并 retarget 到 actions.shader
- View interaction intent: non-spatial — 仍为固定 2D shader 光栅输出，无空间场景
- Interaction ownership: Randomize/Copy params 属 panel action（sticky footer 所有）；reset 归控制面板头部，播放归 Timeline，均不重复占用
- Decision: Randomize 通过 `controls.apply` 一次性提交 effect.preset/amount/scale/phase/speed 的随机值（amount 限 0.15–0.9、speed 限 0.15–1.25 保住可读性区间）；Copy params 序列化 {preset, amount, scale, phase, speed, text, typography} 为 JSON 写 `navigator.clipboard`，成功/失败走 reportFeedback
- Alternatives rejected: 自定义按钮 UI（违反「不复刻 runtime 表面」）；把 panelActions 混进 Effect section（会触发 section 拆分出不稳定 .part- id，inventory 失配）；随机化包含文字内容/排版（会毁掉用户输入）
- State/output mapping: shader.randomize → controls.apply 写 effect.* 五个 target → shader-frame 重渲；shader.copy-params → 读 getShaderParams/getShaderText/getShaderTypography → clipboard；action 不产生新 state target
- Verification: `npx tsc --noEmit` 通过；vite-node 解析 schema 确认 `runtime.export` footer 合并为 `panelActions[shader.randomize, shader.copy-params, export.png]`；app-schema/performance-gates 聚焦测试全过；已知 "Settings" 上游缺陷仍为唯一 acceptance 诊断
- Risks:
  - Risk: `navigator.clipboard` 在非安全上下文或权限拒绝时失败 — 已 catch 并 reportFeedback 提示
  - Risk: footer 合并控件 target 取「首个 panelActions 声明」，若未来 runtime 调整合并顺序需同步更新 acceptance target

### Entry shader-forge-timeline-animation

- Change ID: shader-forge-timeline-animation
- Entry type: feature edit
- Request: "我希望是continous有动画的 然后模式要有很多种 我能想到的是处理edge的部分的 你可以参考figma和framer shader"
- Task type: timeline playback + renderer animation + preset expansion
- User-visible result: shader 输出随顶部 Timeline 播放头连续循环动画；新增 Speed 滑杆与一个循环内周期数语义；Effect preset 扩到 14 种（含 Edge/Chrome 等边缘与梯度类）；播放/暂停/scrub/时长编辑均生效；导出静帧取当前时间轴时刻
- Source/reference checked: docs/toolcraft/core/timeline-animation.md、runtime `timelineModule`/`getToolcraftTimelineLoopProgress`/`useToolcraftViewportInteractionActive`、toolcraft-external-store 的 playback transient lane、vgpu-physical-feedback fixture 的 timeline-playback invalidation 先例
- Reference inputs: None — 无动态参考素材；未注册 referenceInputs
- Docs/contracts read: workflow.md, core/timeline-animation.md, core/performance.md, acceptance-testing.md, runtime timeline/external-store 类型定义
- View interaction intent: non-spatial — 产品是固定 2D 帧上的 fragment shader 光栅输出，无可旋转模型或可编辑空间场景
- Interaction ownership: 播放/暂停/scrub/时长归顶部 Timeline transport；视口拖拽缩放归 runtime viewport；产品侧不自建动画控件
- State/output mapping: state.timeline runtime 播放头 → u_time uniform（loopProgress × 整数周期数）；effect.speed → 每秒周期数；effect.preset/amount/scale/phase → fragment uniforms；scrub 时刻 → 确定性帧与导出帧
- Animation intent: `timeline-playback` — 用户请求 continuous 动画，属产品动画非装饰；loopDuration 8s 产品派生（默认 speed 0.5 周/秒 × 8s = 整数 4 周期，首尾缝合）；panels.timeline.defaultDurationSeconds=8 与之匹配
- Contract rules applied: 播放渲染器消费 runtime `state.timeline`（transient playback lane 每帧驱动 effectiveState → useSyncExternalStore 逐帧重渲）；不用本地 rAF/墙钟；视口交互（viewport transient lane）期间暂停绘制、恢复后按时间轴当前时刻续渲；timelinePlaybackCoverage 五项 + forward-only/first-last-match/reproved-after-edit loop proof
- Decision: `u_time` 语义为「周期数」——`loopTime = loopProgress × round(speed × durationSeconds)`，speed=0 冻结；所有 shader 时间项写为 `sin/cos/mod` 整数周期函数（glitch 为每周期整数步进），保证任意 speed/duration 下首尾帧严格一致
- Alternatives rejected: autonomous decorative 模式（会隐藏 timeline transport，不满足「播放控制」预期且 animationControls 校验要求 timeline）；u_time 直接当秒（speed×duration 非整数时循环不无缝）；speed 离散化为整数（损失连续调节手感，改为内部量化周期数）
- Pipeline: timeline-playback/timeline-scrub 各失效 `shader-frame`（kind 由 pixel-transform 改 `composite` —— 高频交互不得失效昂贵 pass 类；单三角采样贴图本质是 present/composite）；source-texture 永不失效（memoized 源纹理与播放头无关）；effect.speed 加入 control-drag targets 与 shader-frame inputs
- Verification: `npx tsc --noEmit` 通过；validateProductAcceptanceCoverage 仅剩上游 "Settings" 缺陷；app-schema/acceptance timeline-playback/render-scale/view-interaction/performance 聚焦测试全过；Playwright 离屏 WebGL2 编译验证 14 effect 全部编译链接并渲染
- Risks:
  - Risk: playback 每帧触发 React 重渲染 + draw effect —— 依赖 source descriptor memo 保持廉价；若未来 text raster 变重需再分层
  - Risk: `Math.round(speed × duration)` 量化意味着微调 speed 在跨越周期数边界时才改变视速率

### Entry shader-forge-first-delivery

- Change ID: shader-forge-first-delivery
- Entry type: first-delivery
- Request: "shader with custom text or image as input, react web app" + "你可以看看合适不合适 https://toolcraft.sh/ npx @pixel-point/toolcraft create"
- Task type: first product delivery — new Toolcraft app with a custom WebGL renderer
- User-visible result: 画布上 shader 输出把输入文字或上传图片按所选 preset 做像素级变形；控制面板可切换 Source 类型、编辑文字与排版、上传/变换图片、调节效果参数、开关背景；Export 导出 PNG/JPG 静帧
- Source/reference checked: Toolcraft 官方 examples（logo-sphere 的 canvasContent/rasterFrameRenderer/rendererPipeline 结构）与本仓库 vendored runtime 类型
- Reference inputs: None — 无动态参考素材；未注册 referenceInputs
- Docs/contracts read: workflow.md, renderer-technique.md, controls/setup-export/persistence/performance/acceptance 文档与 runtime 类型定义
- Contract rules applied: runtime-shell-required, canvas-no-app-ui, controls-section-inventory-required, output-export-required, renderer-gpu-provider, persistence-policy-explicit, performance-coverage-levels
- View interaction intent: non-spatial — 产品是固定 2D 帧上的一张 fragment shader 光栅输出，没有可旋转观察的模型或可编辑空间场景
- Interaction ownership: 所有产品操作（Source 切换、文字内容、排版、图片上传变换、效果参数）都是 panel property-edit；canvas 上只有 runtime viewport 平移缩放，无产品级画布直接操纵
- Decision: 原生 WebGL2 预览 + 同一渲染器离屏合成到 runtime 提供的导出上下文；文字经 OffscreenCanvas 2D 栅格化 + FontFace 字体加载成纹理，图片经 media presentation URL → fetch → createImageBitmap 成纹理，fragment shader 用 cover-fit UV + rotate/flip 变换采样源纹理
- Alternatives rejected: Canvas 2D（无法表达 domain-warp 位移/halftone/通道分离的逐像素效果）；DOM/CSS filter（无法 cover-fit 逐像素且导出像素不一致）；three.js（无三维需求且边界扫描成本不值）；Layers/Timeline（用户未请求图层工作流与时间轴）
- State/output mapping: source.kind → 源分支选择；text.content/text.typography → 文字纹理栅格化输入；source.image + transform → 图片纹理与 rotate/flip；effect.preset/amount/scale/phase → fragment uniforms；export.includeBackground + appearance.background → runtime 背景与导出合成；canvas.size/renderScale → 画布与 backing 分辨率；export.image.format/resolution → runtime 导出产物
- Verification: 已跑 `npx tsc -p tsconfig.json --noEmit` 通过、`node scripts/check-toolcraft-integrity.mjs` 通过（847 文件）、`npx vitest run src` 产品侧全过；已知 4 个受保护测试失败为脚手架上游缺陷（见 Verification 段）
- Risks:
  - Risk: 大图上载一次解码一张全分辨率纹理，交互上限声明为 16Mpx；超限图片无产品侧采样降级
  - Risk: FontFace 手动解析 Google Fonts css2 响应，若 Google 改返回格式字体回落到 sans-serif 但功能不中断
  - Risk: WebGL2 不可用时产品只显示不可用 surface；无 Canvas2D 兜底渲染器

## Decisions

### Renderer

- Decision: 裸 WebGL2（无 three.js）预览与导出；`source-texture` pass 只产出结构化 `ShaderSourceDescriptor`（text: 文本+排版+纵横比；image: assetId+transform），栅格化/解码在 renderer 层物化（OffscreenCanvas 2D 文字栅格、fetch+createImageBitmap 图片纹理），`shader-frame` pass 为 GPU stateless render，`shader-export` 为 export-only pass。
- Reason: DOM 值（canvas/ImageBitmap/element）不能穿过 pass 契约的结构化边界——类型溯源会把 lib.dom 能力判为被擦除；且 `document.createElement`/`on*` 属性属 DOM host-factory 与交互语义，归 runtime 原语所有。
- Evidence: src/app/shader/shader-pipeline.ts + shader-gl.ts + shader-text.ts + shader-media.ts + shader-output.tsx + shader-export.ts；rendererTechnique.gpu.preview/export = { backend: "webgl", provider: "native", exception: browser-compatibility }。
- Boundary findings: (1) `document.createElement` 全禁，canvas 一律 `new OffscreenCanvas`；(2) `gl.ONE`/`gl.ONE_MINUS_SRC_ALPHA` 因 `on*` 前缀扫描被误判，改数值常量 GL_ONE/GL_ONE_MINUS_SRC_ALPHA；(3) `image.onload` 禁用，改 `fetch` + `createImageBitmap`；(4) async 函数不能直接 return DOM 值（Promise 包装算擦除），拆成 async 准备 + sync 取 DOM；(5) `@/toolcraft/ui` 深路径 import 私有，字体加载改用公共 FontFace API + fetch css2。

### View Interaction

- Decision: `non-spatial`。
- Reason: 输出是固定构图的 2D 光栅帧；effect 参数是排版/风格参数而非相机；无 orientationGizmo。
- Evidence: 用户请求未要求旋转/三维交互；appProductReadiness.viewInteraction.mode = "non-spatial"。
- Alternatives: orbit/fixed-camera（产品与参考都不需要，无正证据）。

### Interaction Ownership

- Decision: 无 canvas 级产品操作声明；全部交互为 panel property-edit，由 acceptance 行 interactionId 覆盖。
- Reason: 用户需求是控件驱动的 shader 调节；canvas 上不需要直接操纵源内容。
- Evidence: app-acceptance-data.ts 各 control 行 interactionId；runtime viewport 交互为 runtime 所有。

### Timeline

- Decision: 不启用 timelineModule；无 animationIntent 时间轴行为。
- Reason: 用户未请求动画/transport；phase 是手动参数而非自动播放。
- Evidence: schema 无 timeline；acceptance 无 timeline 行。

### Layers

- Decision: 不启用 layersModule。
- Reason: 单一产品输出层（shader 帧），用户未请求图层工作流。
- Evidence: schema 无 layers；acceptance 无 layer 行。

### Controls

- Decision: 四个产品 section — Source（type 切换 + text 输入 + image fileDrop）、Typography（fontPicker 复合控件，label: false 由 section 提供上下文）、Effect（preset segmented + amount/scale/phase 滑杆）、Background（export.includeBackground + appearance.background 标准对，被 runtime 收编进 Setup）。
- Reason: 按实体分组 = 源内容 / 文字排版 / 效果参数 / 输出背景；全部内置控件无自定义。
- Evidence: appControlSectionInventory 逐 target 声明；finiteSelectors 中 source.kind/export.includeBackground 为 branch，effect.preset/export.image.format/resolution 为 parameter。

### Export

- Decision: image export = toolcraft-default（Export PNG/JPG，2K/4K/8K）；svg/video = not-requested。
- Reason: 用户未请求 SVG 或视频交付；shader 静帧 PNG/JPG 是默认意图。
- Evidence: productReadiness.exportIntent + imageExportModule() + scene.rasterFrameRenderer；export.action.image 行带 actionCoverage ["export.png"] + all-required-image-export-behavior。

### Performance

- Decision: 三个 workload 维度 — source-mode（schema-target source.kind，离散 0/1）、source-image-pixels（schema-target source.image，interactive 16Mpx/batch 64Mpx）、export-resolution（schema-target export.image.resolution，batch 7680，quadratic）；source-texture 为 memoized 离散 pass，shader-frame 为 frame GPU pass，shader-export 为 batch pass；viewport-drag/zoom 不失效任何 pass（输出为固定分辨率光栅）。
- Reason: 文字栅格与图片解码成本随源尺寸增长且只在源输入变化时发生；逐帧渲染成本相对恒定；zoom 只改显示缩放不改输出像素。
- Evidence: app-performance.ts 中 rendererPipeline + workloadEnvelope + fixtureAdapters + deriveToolcraftPerformancePaths 派生 scenarios；validateToolcraftPerformanceCoverage 无错误。

## Evidence

- Source reviewed: Toolcraft 官方 examples（logo-sphere）与 vendored runtime/testing/acceptance 类型。
- Contract applied: defineToolcraft + composeToolcraftApp + scene.canvasContent/rasterFrameRenderer/renderer.pipelineRegistration；内置控件优先；无 canvas 内 app UI。

## Verification

- 已跑：`npx tsc -p tsconfig.json --noEmit` 通过。
- 已跑：`node scripts/check-toolcraft-integrity.mjs` 通过（847 个受保护文件，含边界扫描零违规）。
- 已跑：`npx vitest run src` — 产品自有测试全过；`validateProductAcceptanceCoverage` 仅剩 1 条上游缺陷、`validateToolcraftPerformanceCoverage` 为空。
- 已知上游缺陷（在 verse-wall-studio 等未改受保护文件的同类生成应用上复现，受保护文件不可改）：
  - "Settings is too generic"：标准 Background 对被归一化进 runtime Setup section，其固定标题触发 generic-title 规则（`app-acceptance.base-coverage.test.ts` 两处；产品侧 `app-schema.test.ts` 显式过滤这一条）。
  - `control-applicability-cases.test.ts` "Expected normalized Setup background control"：fixture 无背景对时归一化行为与断言不一致。
  - `app-acceptance.section-titles.test.ts` "untitled section 3" vs 断言的 "section 2"：runtime.defaults 归一化插入导致 section 索引漂移。
- 待跑：`npm run verify:delivery` 首次功能交付门（含 build + Playwright，需用户确认）；浏览器验收（文字渲染、图片上传、四 preset、背景开关、PNG/JPG 导出、持久化恢复）。

## Risks

- Risk: Playwright chromium 未安装时 verify:delivery 需要先下载浏览器；属一次性环境成本。
- Risk: 大图上传按声明上限 16Mpx 解码；超限无降级策略，超大图片可能拖慢 discrete source pass。
- Risk: Google Fonts css2 响应格式变化时 FontFace 解析失效，字体回落 sans-serif（不阻塞功能）。
- Risk: WebGL2 缺失环境（旧设备/受限 WebView）只见不可用提示，无二度兜底。
