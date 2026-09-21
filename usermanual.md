# Shader Forge 使用手册

Shader Forge 是一个把文字或图片变成动态 shader 视觉效果的网页编辑器。你在画布上实时看到循环动画效果，调好后一键导出 PNG/JPG 图片。

## 快速开始

1. 打开应用后，画布中央会显示默认文字 "SHADER" 经过 Flow 效果的循环动画渲染。
2. 底部 Timeline 面板控制动画播放：Play/Pause、拖拽进度条精确定位、编辑循环时长（默认 8 秒）。
3. 右侧 Controls 面板从上到下分四个区块：Source、Typography、Effect、Setup（含 Background、Image Export）。

## Source（来源）

- **Type**：切换 shader 的输入来源 —— `Text`（自己输入的文字）或 `Image`（上传的图片）。
- **Text**（Text 模式）：直接编辑要渲染的文字内容。
- **Image**（Image 模式）：拖拽或点击上传图片；上传后可用控件旋转、翻转、移除或重置。

## Typography（排版）

仅在 Text 模式可见。调整文字栅格化的样式：字体、字号、字重、字距、行高、透明度、大小写与颜色。所有修改实时反映到 shader 输出。

## Effect（效果）

- **Preset**：21 种 fragment shader 效果 —
  - `Flow`：流体式 domain-warp 扭曲
  - `Ripple`：涟漪扩散
  - `Wave`：波浪形变
  - `Swirl`：旋涡旋转
  - `Kaleido`：万花筒镜像
  - `Glitch`：通道分离故障风
  - `Chromatic`：径向色散呼吸
  - `Pixelate`：像素化呼吸
  - `Halftone`：半调网点
  - `Dither`：Bayer 抖动
  - `Posterize`：色阶海报化
  - `Edge`：霓虹边缘描边
  - `Chrome`：梯度金属色带
  - `Grain`：动态颗粒噪点
  - `Liquid`：彩虹流体混色（保持轮廓可读）
  - `Aura`：边缘彩色辉光（保持轮廓可读）
  - `Prism`：棱镜边缘着色（保持轮廓可读）
  - `Cylinder`：文字环绕旋转圆柱，多层堆叠（STG 风格）
  - `Flag`：飘旗波浪 + 褶皱明暗（STG 风格）
  - `Coil`：侧视弹簧螺旋（STG 风格）
  - `Stripes`：竖条百叶窗波浪（STG 风格）
- **Amount / Scale / Phase**：效果强度、空间尺度与相位偏移，拖动滑杆实时预览。
- **Speed**：动画速率（每秒钟的循环周期数），0 为静止画面。

## 底部操作栏

- **Randomize**：随机换一个 preset 并生成一组协调的参数（强度/尺度/相位/速率），快速探索效果。参数范围经过约束，文字模式下大概率保持可读；不满意就再点一次。
- **Copy params**：把当前效果的完整配方（preset + amount/scale/phase/speed + 文字与排版）复制为 JSON。粘贴存到笔记里就是一个 preset，下次照着参数手动调回即可。
- **Export PNG / Export JPG**：导出当前播放头那一帧的图片。

## Timeline（时间轴）

底部时间轴面板控制动画播放：

- **Play / Pause**：播放或暂停动画；暂停时画面冻结在当前帧。
- **Scrub**：拖拽进度条查看任意时刻的确定性画面。
- **Duration**：编辑循环总时长（默认 8 秒）；修改后动画依然首尾无缝衔接。
- 动画为前向无缝循环：每个循环内包含整数个效果周期，首帧与末帧完全一致。
- 导出的图片使用当前时间轴位置对应的画面，所见即所得。

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
