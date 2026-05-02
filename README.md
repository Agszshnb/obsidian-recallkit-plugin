# RecallKit

语言：中文 | [English](README.en.md)

RecallKit 是一个面向 Obsidian 的知识卡片生成插件。它可以把粘贴文本、网页 URL、以及 vault 中的 PDF 转换为结构清晰、可继续编辑的 Markdown 卡片，帮助用户把阅读材料快速沉淀进个人知识库。

适合用于：

- 阅读文章、报告、论文和社交媒体长文后快速整理要点。
- 把网页内容转成可检索、可链接、可复盘的 Obsidian 笔记。
- 为产品调研、竞品分析、行业新闻和资料归档生成统一格式的知识卡片。
- 在保存前预览并调整 AI 生成内容，保留人工判断和编辑空间。

## 核心功能

- **文本转卡片**：粘贴任意文本后生成结构化 Markdown 知识卡片。
- **网页转卡片**：输入 URL，自动提取可读正文并用于分析。
- **PDF 转卡片**：选择 vault 中的 PDF，可使用内置 pdf.js 本地提取文本，也可配置 MinerU 云端 API 进行 OCR、表格、公式和复杂版面解析。
- **保存 MinerU 解析结果**：可把 MinerU 返回的 `full.md` 保存到当前 vault，默认文件夹为 `RecallKit Sources`。
- **多种分析模板**：内置通用内容、新闻 / 事件、论文 / 文献、社交媒体等分析角度。
- **自定义 Prompt**：支持选择 vault 中的 Markdown prompt，或在弹窗中手动输入分析要求。
- **长文分段分析**：短内容单次分析，长 URL / PDF / 文本会自动切分、分段分析并综合成最终卡片。
- **保存前预览**：生成结果可在保存前检查和编辑。
- **自动归档**：卡片保存到可配置的 vault 文件夹，并自动避免覆盖已有文件。
- **开放模型配置**：支持 OpenAI-compatible Chat Completions API，默认配置面向 DeepSeek。

## 使用方法

1. 在 Obsidian 中打开 **Settings > Community plugins > RecallKit**。
2. 填写 API base URL、API Key 和模型名称，例如 `https://api.deepseek.com` 与 `deepseek-chat`。
3. 配置 PDF 解析方式：内置 pdf.js 为本地文本提取；MinerU 云端 API 需要填写 MinerU Token，可处理 OCR、表格、公式和复杂版面。
4. 设置默认分析模板、输出文件夹和默认标签。
5. 点击左侧功能区的 RecallKit 图标，或在命令面板中运行 **Create knowledge card / 创建知识卡片**。
6. 选择输入来源：粘贴文本、输入网页 URL，或选择 vault 中的 PDF。
7. 选择分析模板，也可以切换到自定义 prompt。
8. 点击 **Analyze** 生成卡片，预览并编辑后保存到 vault。

## 生成卡片内容

RecallKit 会把模型输出整理为 Markdown 文件，方便继续使用 Obsidian 的双链、标签、搜索和文件夹管理。典型卡片可以包含：

- 内容摘要和核心观点。
- 关键事实、人物、时间线或数据点。
- 可复盘的问题和行动建议。
- 来源信息、标签和创建时间。

具体结构会根据所选模板和自定义 prompt 调整。

## 安装

目前可通过 GitHub Release 手动安装：

1. 下载 release 中的 `manifest.json`、`main.js`、`styles.css` 和 `prompts/literature-review.md`。
2. 在你的 vault 中创建插件目录：

```text
VaultFolder/.obsidian/plugins/recallkit/
```

3. 把前三个文件放入该目录，并保留 `prompts/literature-review.md` 的相对路径。
4. 重启 Obsidian，进入 **Settings > Community plugins**，启用 **RecallKit**。

## 隐私和网络使用

RecallKit 不包含遥测、广告或 RecallKit 云服务。

点击 **Analyze** 后，插件会把你选择的文本、网页正文或 PDF 解析后的 Markdown 发送到你在设置中配置的 OpenAI-compatible API endpoint。模型 API Key 通过 Obsidian 插件数据保存在本地，不会写入生成的 Markdown 卡片。

处理 PDF 时，RecallKit 只会读取你在当前 vault 中选择的文件。如果 PDF 解析器设置为 MinerU 云端 API，插件会把所选 PDF 上传到 MinerU 进行解析，下载结果压缩包并提取 `full.md` 用于卡片生成。MinerU API Token 保存在本地插件数据中，不会写入生成的卡片。

如果设置中开启“保存 MinerU Markdown”，插件会把 MinerU 返回的 `full.md` 保存到当前 vault，默认文件夹为 `RecallKit Sources`。

处理 URL 时，RecallKit 会请求你输入的网页地址并提取可读文本；当网页直连提取效果不佳时，会使用 Jina Reader（`https://r.jina.ai/`）获取更适合阅读的 Markdown 文本，然后再发送给你配置的模型服务。

## 项目状态

RecallKit 0.1.0 已完成核心知识卡片工作流：输入内容、选择分析模板、PDF 解析、长文分段分析、调用模型生成、预览编辑、保存到 Obsidian vault。后续会继续围绕 URL 提取质量、PDF 语义分段、安装体验和官方社区插件分发进行完善。

维护者查看详细开发进度请读 [`docs/progress.md`](docs/progress.md)；AI 接手项目请读 [`AGENTS.md`](AGENTS.md)。
GitHub 源码同步和 Release 上传规则请读 [`docs/github-upload-checklist.md`](docs/github-upload-checklist.md)。

## 开发者

本项目使用 TypeScript 构建，遵循 Obsidian 插件标准结构。

```powershell
npm install
npm run build
```

构建后会生成 Obsidian 插件运行所需的 `main.js`。发布资产包括：

- `manifest.json`
- `main.js`
- `styles.css`
- `prompts/literature-review.md`
