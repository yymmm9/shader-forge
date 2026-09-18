# Changelog

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
