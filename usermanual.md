# Shader Forge 使用手册

Shader Forge 是一个把文字或图片变成 shader 视觉效果的网页编辑器。你在画布上实时看到效果，调好后一键导出 PNG/JPG 图片。

## 快速开始

1. 打开应用后，画布中央会显示默认文字 "SHADER" 经过 Flow 效果的渲染结果。
2. 右侧 Controls 面板从上到下分四个区块：Source、Typography、Effect、Setup（含 Background、Image Export）。

## Source（来源）

- **Type**：切换 shader 的输入来源 —— `Text`（自己输入的文字）或 `Image`（上传的图片）。
- **Text**（Text 模式）：直接编辑要渲染的文字内容。
- **Image**（Image 模式）：拖拽或点击上传图片；上传后可用控件旋转、翻转、移除或重置。

## Typography（排版）

仅在 Text 模式可见。调整文字栅格化的样式：字体、字号、字重、字距、行高、透明度、大小写与颜色。所有修改实时反映到 shader 输出。

## Effect（效果）

- **Preset**：选择 fragment shader 效果 —
  - `Flow`：流体式 domain-warp 扭曲
  - `Ripple`：涟漪扩散
  - `Halftone`：半调网点
  - `Glitch`：通道分离故障风
- **Amount / Scale / Phase**：效果强度、空间尺度与相位，拖动滑杆实时预览。

## Setup（画布与导出）

- **Canvas**：画布尺寸（宽高像素）、Infinity canvas 开关、Render scale（预览清晰度倍率）。
- **Background**：开关输出背景并选择颜色；关闭时预览为透明、PNG 导出带透明通道。
- **Image Export**：导出格式（PNG/JPG）与分辨率（2K/4K/8K）。

## 导出图片

点击底部 **Export PNG**（或所选格式）下载当前 shader 输出的静帧图片，分辨率与背景设置按 Image Export / Background 生效。

## 其他

- **持久化**：画布尺寸、控件值、面板布局自动保存在浏览器本地，刷新后恢复。
- **快捷键/工具栏**：顶部工具栏提供撤销重做、缩放、主题切换。
- **兼容性**：需要支持 WebGL2 的浏览器（Chrome/Edge/Firefox/Safari 较新版本）；不支持时画布显示不可用提示。
