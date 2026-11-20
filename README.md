# LuminoDish · 深海荧光培养皿音乐盒

> *A bioluminescent cellular automata music box in the browser.*

在深海培养皿里滴入荧光浮游生物，随着声呐光束按节拍扫过网格，它们会依据纵坐标音高奏出空灵的马林巴、玻璃风铃或水晶竖琴声，并在每小节结束后遵循康威生命游戏（Conway's Game of Life）规则自我演化。

零乐理也能随手点出治愈、不会冷场的深海生成音乐。

## 特性一览

- **深海荧光视觉**：高分屏 Canvas 2D 渲染的玻璃培养皿、呼吸感荧光细胞、声呐扫描光束、有机水波纹与上升微光粒子。
- **零依赖 Web Audio 合成引擎**：纯原生 Web Audio API 程序化合成**空灵马林巴**、**玻璃风铃**、**水晶竖琴**，内置深海卷积混响、立体声回声与可开关的海底低频氛围底噪。
- **四种治愈音阶**：深海五声（Pentatonic）、治愈利底亚（Lydian）、深海小调（Dorian）、日本平调（Hirajoshi）。
- **预设生物图鉴**：内置荧光水母、浮游滑翔队、深海珊瑚、海葵律动、随机浮游群。
- **生态自愈 / 无限助眠模式**：自动监测灭绝或短周期死循环，温柔滴入新荧光孢子，让音乐永不枯竭。
- **URL 一键分享**：将 16×16 培养皿状态与音阶、音色、BPM 紧凑编码至 URL Hash，复制链接即可分享作品。
- **一键录制导出**：结合 `canvas.captureStream()` 与 `MediaStreamAudioDestinationNode`，直接在浏览器导出带声音的 `.webm` 短片。

## 快捷键

| 按键 | 功能 |
| :--- | :--- |
| `Space` | 播放 / 暂停 |
| `S` | 手动演化一代 |
| `C` | 清空培养皿 |
| `R` | 播撒随机浮游群 |
| 左键点击 / 拖拽 | 绘制或擦除荧光细胞 |
| 右键拖拽 | 擦除细胞 |

## 本地运行

```bash
npm install
npm run dev
```

构建生产版本：

```bash
npm run build
npm run preview
```

## 部署到 GitHub Pages

仓库已内置 `.github/workflows/deploy.yml`：

1. 将代码推送到 GitHub 仓库的 `main` 分支。
2. 在仓库 `Settings -> Pages` 中，将 **Source** 设置为 **GitHub Actions**。
3. 等待 Action 完成，即可通过 GitHub Pages 链接直接在线把玩。

## License

MIT
