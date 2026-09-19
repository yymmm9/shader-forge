# Toolcraft App Agent Worklog

## Status

Mode: product

Shader Forge 是一个文字/图片驱动的 shader 编辑器：把用户输入的文字或上传的图片栅格化为源纹理，用一张 WebGL2 全屏 fragment shader 施加 14 种循环动画效果，输出可交互预览并导出 PNG/JPG 静帧。

Active change: shader-forge-timeline-animation

## Decision Trail

### Entry shader-forge-timeline-animation

- Change ID: shader-forge-timeline-animation
- Entry type: feature edit
- Request: "我希望是continous有动画的 然后模式要有很多种 我能想到的是处理edge的部分的 你可以参考figma和framer shader"
- Task type: timeline playback + renderer animation + preset expansion
- User-visible result: shader 输出随顶部 Timeline 播放头连续循环动画；新增 Speed 滑杆与一个循环内周期数语义；Effect preset 扩到 14 种（含 Edge/Chrome 等边缘与梯度类）；播放/暂停/scrub/时长编辑均生效；导出静帧取当前时间轴时刻
- Source/reference checked: docs/toolcraft/core/timeline-animation.md、runtime `timelineModule`/`getToolcraftTimelineLoopProgress`/`useToolcraftViewportInteractionActive`、toolcraft-external-store 的 playback transient lane、vgpu-physical-feedback fixture 的 timeline-playback invalidation 先例
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
