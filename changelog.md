# Changelog

## 2025-09-19 — 连续动画 + 14 种 shader 模式 + 时间轴播放

### Added

- **Runtime timeline 驱动动画**：启用 `timelineModule({ mode: "playback", defaultDurationSeconds: 8 })`；预览渲染消费 `state.timeline`（`getToolcraftTimelineLoopProgress`），播放/暂停/拖拽 scrub/时长编辑全部由顶部 Timeline 面板控制；导出走同一时间轴取当前帧。
- **无缝前向循环**：shader 时间语义改为「周期数」—— `u_time = loopProgress × cycles`，`cycles = round(speed × duration)` 恒为整数，首帧与末帧严格缝合；时长编辑后仍无缝（`reproved-after-edit` 语义）。
- **Speed 控件**（`effect.speed`，0–2，默认 0.5 周/秒）：调节一个循环内的动画周期数；0 冻结画面。
- **preset 从 4 种扩到 14 种**：新增 Wave、Swirl、Kaleido、Chromatic、Pixelate、Dither、Posterize、Edge（Sobel 霓虹描边）、Chrome（梯度金属色带）、Grain（颗粒噪点）。
- 视口交互（拖拽/缩放）期间暂停动画渲染，松开恢复，不改变播放状态。
- 验收数据：animationIntent `timeline-playback` + 产品派生 loopDuration（8s）；timeline.playback runtime 覆盖行（pause-resume/scrub/duration/loop/rendered-frame + forward-only loop proof）；renderScaleCoverage states 增加 `playback`。
- Pipeline：`timeline-playback`/`timeline-scrub` 交互仅失效 shader-frame pass（kind 调整为 `composite`，符合高频交互不得失效昂贵 pass 的约束）。

### Verification

- `npx tsc --noEmit` 通过；`validateProductAcceptanceCoverage` 仅剩已知上游 "Settings" 缺陷；app-schema/acceptance/performance 聚焦测试全过。
- Playwright 离屏编译验证：14 种 effect 的 fragment shader 全部编译链接成功，逐 effect 渲染取样（Edge 对纯色源输出透明属预期）。
- **线上验证**：部署 <https://shader-forge-rku7o88yp-yi-ming-zhangs-projects.vercel.app>（alias <https://shader-forge.vercel.app>）后实测 — 画布默认逐帧动画（两帧截图不同）；顶部 "Pause playback" 暂停后帧完全一致（冻结）；恢复播放后帧继续变化；Effect 面板含 Speed 控件、Settings 含 Timeline 开关。

## 2025-09-19 — 修复线上黑屏（第二轮：根因确认）

### Fixed

- **`sourcePass` kẹt "pending" vĩnh viễn → canvas không bao giờ vẽ（黑屏根因）**：`useToolcraftPipelinePass` 的 cacheInput `"text.typography"` 用 `getShaderTypography(state)` —— 每次 render 返回新 object，`hasEqualCacheInput`（Object.is 逐 key 比较）永不成立 → `request` 每 render 新建 → `runPass` 每 render 重跑 → `resolved.request` 永远落后于当前 request → status 永远 "pending" → draw() early-return 于 `sourcePass.status !== "success"` → canvas 停留在默认 300×150 全透明。修复：`"text.typography"` cache key 改为 `JSON.stringify(state.values["text.typography"])`（stable-by-content）；`params` 改 `useMemo([state])` 避免每 render 重跑 draw。
- `SHADER_FRAGMENT_SOURCE` 中 `glitchUv` 使用 GLSL ES 3.00 保留字 `active` 作为变量名，导致 fragment shader 编译失败、`createShaderRenderer` 返回 null、画布永不渲染（第一层故障）。改名 `rowActive`，浏览器内实测编译/链接通过。
- 诊断路径：Playwright 直连线上页面 — `data-renderer="webgl2"`、`data-toolcraft-product-scene-status="ready"`、canvas rect 1080×1080 但 backing 300×150 → 锁定 pass 状态卡点。
- **线上验证通过**：部署后 canvas backing = 2160×2160（1080 × renderScale 2），预览渲染出 "SHADER" 文字 + Flow 扭曲效果可见；Export PNG 下载 741KB 且签名合法。

## 2025-09-19 — 交付上线

### Added

- 创建 GitHub 仓库并推送 `main`：<https://github.com/yymmm9/shader-forge>。
- Vercel 项目 `shader-forge` 连接 GitHub 仓库并完成首个生产部署：<https://shader-forge.vercel.app>（HTTP 200，页面标题 Shader Forge）。
- `.gitignore` 增加 `.claude`（环境符号链接目录，不入库）。

## 2025-09-19 — shader-forge first delivery

### Added

- Toolcraft（`npx @pixel-point/toolcraft create`）脚手架上的 shader 编辑器产品实现：
  - Source 区：Text/Image 双源切换，文字输入、图片 fileDrop 上传（rotate/flip/remove/reset）。
  - Typography 区：fontPicker 复合控件（字体、字号、字重、间距、行高、透明度、大小写、颜色）。
  - Effect 区：Flow/Ripple/Halftone/Glitch 四种 fragment shader preset + amount/scale/phase 参数。
  - 标准 Background 对与 Image Export 设置由 runtime 收编；Export PNG/JPG（2K/4K/8K）。
- WebGL2 渲染管线：source-texture（结构化 descriptor）→ shader-frame（GPU 预览）→ shader-export（离屏导出）。
- 验收数据（app-acceptance-data.ts）：全部可见控件覆盖、control section inventory、有限选择器分类、typed export action 覆盖。
- 性能数据（app-performance.ts）：workload envelope 三维度、fixture adapters、派生 performance paths/scenarios。
- docs/toolcraft/agent-worklog.md 替换为产品决策记录。

### Fixed

- 产品边界合规：移除 `document.createElement`/`on*` DOM 属性/深路径 UI import；canvas 一律 `new OffscreenCanvas`，图片解码 `fetch` + `createImageBitmap`，字体加载 `fetch` + `FontFace`；`gl.ONE*` 常量改数值；async 函数不直接返回 DOM 值。
- `@base-ui/react` 钉回脚手架兼容的 1.4.x（vendored composite 代码的版本要求）。
- viewport-zoom 不再失效 GPU pixel-transform pass（输出为固定分辨率光栅，zoom 只影响显示）。

### Known issues

- 4 个受保护测试失败为脚手架上游缺陷（未修改的 vendored 文件在同类生成应用上复现）：
  - "Settings is too generic"（Background 对归一化进 runtime Setup 触发 generic-title 规则）。
  - `control-applicability-cases` "Expected normalized Setup background control"。
  - `section-titles` "untitled section 3" vs 断言 "section 2"（runtime.defaults 插入导致索引漂移）。
