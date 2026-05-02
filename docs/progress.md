# RecallKit 开发进度

语言：中文 | [English](progress.en.md)

最后更新：2026-05-02
当前版本：0.1.0

## 文档定位

这份文档面向项目 owner，用来回答“已经做完什么、还有什么限制、下一步该做什么”。

- 面向用户的介绍放在根目录 `README.md` / `README.en.md`。
- AI 接手上下文放在根目录 `AGENTS.md`。
- 流程图和模块职责放在 `docs/workflow.md`。
- GitHub 源码同步和 Release 资产规则放在 `docs/github-upload-checklist.md`。

## 当前状态

RecallKit 仍处于 Obsidian 插件本地 MVP 开发阶段。当前目标是把文本、网页 URL 和 vault 中的 PDF 转换为结构化 Markdown 知识卡片。PDF 已支持两条解析路径：内置 pdf.js 本地文本提取，以及可选 MinerU 云端 API 高保真解析。

## 已完成

### M0：文本知识卡片

- 支持从粘贴文本生成 RecallKit 知识卡片。
- 支持调用 OpenAI-compatible Chat Completions API。
- 支持配置 API base URL、API Key、模型、输出文件夹、默认标签和创建后自动打开。
- 支持保存前预览和编辑 Markdown。
- 写入 vault 时自动避免覆盖已有文件。

### M1：PDF 基础提取

- 支持列出当前 vault 中的 PDF 文件。
- 内置 pdf.js 可从文本型 PDF 中提取可复制文字。
- 支持把 PDF 路径、页数和截断提示加入分析输入。
- 扫描版 PDF OCR 通过可选 MinerU 云端 API 处理。

### M2：URL 提取

- 支持 URL 输入模式。
- 自动规范化 URL，省略协议时补 `https://`。
- 支持 MinerU 云端 API 把网页解析为 Markdown，也保留 Obsidian `requestUrl` 直连抓取路径。
- 支持从 HTML 中提取标题和正文。
- 支持纯文本、JSON、XML、Markdown 类响应。
- 生成卡片时写入 URL 来源信息。

### M2.1：Jina Reader URL fallback

- 直连抓取失败或正文太短时，自动尝试 Jina Reader。
- 标记提取方式为 direct request 或 Jina Reader fallback。
- 检测登录页、反爬页、shell 页和常见知乎壳页面，避免把无效内容送入模型。
- README 中记录 Jina Reader fallback 和隐私影响。

### M2.2：内置分析模板切换

- 支持通用内容、新闻 / 事件、论文 / 文献、社交媒体等内置模板。
- 设置页可配置默认内置模板。
- 创建卡片弹窗中可临时切换模板。
- 保留 vault Markdown prompt 和手动 prompt。

### M2.3：长文档分析和进度反馈

- 短内容单次调用模型。
- 默认单次分析上限为 200,000 字符，未超过上限时完整内容一次性交给 LLM。
- 超过单次分析上限时先弹窗提示，用户确认后才改用分段分析。
- 分段分析仍按约 20,000 字符切分，并发 2 个分段分析，再综合生成最终卡片。
- 分段分析总输入安全上限为 500,000 字符。
- 弹窗显示准备内容、单次分析、切分、分段分析、综合、生成预览等阶段进度。
- 模型 JSON 解析更宽容，支持剥离代码块并从响应中提取 JSON 对象。

### M2.4：Release 资产整理

- `npm run release:stage` 会先生产构建，再把发布文件整理到 `dist/recallkit-0.1.0/`。
- 发布资产包括 `manifest.json`、`main.js`、`styles.css` 和 `prompts/literature-review.md`。

### M2.5：动态卡片 sections

- 最终模型输出使用动态 `sections` 数组，不再固定为 summary / core_points / key_arguments / specific_actions。
- 每个 section 支持 `title`、`content` 和 `items`。
- Markdown 渲染按 sections 生成二级标题。
- 仍兼容旧字段输出，会自动转换为 sections。

### M2.6：MinerU 云端 PDF 解析

- 设置页新增 PDF 解析器：内置 pdf.js / MinerU 云端 API。
- MinerU 云端设置包括 API Token、模型版本、OCR、表格识别、公式识别、文档语言、轮询超时。
- 实现 MinerU `/api/v4/file-urls/batch` 签名上传流程。
- 轮询 `/api/v4/extract-results/batch/{batch_id}` 等待任务完成或失败。
- 下载 MinerU 结果 zip，提取 `full.md`，送入现有知识卡片分析流程。
- 优先使用 Node `zlib.inflateRawSync` 解压 zip，避免 Obsidian Electron 中浏览器解压流卡住。
- 可选把 MinerU `full.md` 保存到当前 vault，默认文件夹为 `RecallKit Sources`。
- 分析中禁止关闭弹窗，避免任务仍在运行但 UI 消失。
- 新增 MinerU 相关设置项和进度提示的中文显示。
- 新增“单次分析上限”设置，避免 90k 字符左右的 MinerU Markdown 被自动分段。

### M2.7：MinerU 云端 URL 解析

- 设置页新增 URL 解析器：MinerU 云端 API / 直连 + Jina Reader。
- URL 模式可通过 MinerU `/api/v4/extract/task` 提交远程网页，并使用 `model_version: "MinerU-HTML"`。
- 轮询 `/api/v4/extract/task/{task_id}`，下载结果 zip，提取 `full.md`，再送入现有卡片分析流程。
- 可选把 MinerU URL 解析得到的 `full.md` 保存到配置的 `RecallKit Sources` 文件夹。
- 保留原有直连请求 + Jina Reader 的路径，作为显式可选的 fallback 解析器。
- PDF 模式保存 MinerU Markdown 时会同步保存 `images/` 图片资源，并把 Markdown 图片链接改写到同名 assets 文件夹。

## 已知限制

- MinerU 云端 API 需要用户自行提供 Token。
- MinerU 结果目前保存 `full.md` 和 PDF Markdown 引用到的图片资源，不保存完整 zip 或 `content_list.json`。
- 超过单次分析上限并确认分段后，长文档分析仍按字符切分，尚未利用 MinerU `content_list.json` 做语义分段。
- 网站反爬、登录页和重 JavaScript 页面可能导致 URL 提取失败。
- 移动端行为尚未验证；MinerU 云端解析更适合桌面使用。

## 建议手工测试

- 文本模式：粘贴短文并生成知识卡片。
- PDF / pdf.js 模式：选择文本型 PDF，确认能进入预览。
- PDF / MinerU 云端模式：配置 MinerU Token，选择 vault PDF，确认能上传、解析、保存 `full.md`、保存图片资源并进入卡片预览。
- URL / MinerU 云端模式：配置 MinerU Token，输入公开文章 URL，确认 `MinerU-HTML` 解析能进入卡片预览，并在开启保存时写入 `full.md`。
- URL 直连模式：测试 `https://example.com`。
- URL fallback 模式：测试直连失败但 Jina Reader 可读的页面。
- URL blocked 模式：测试知乎等反爬页面，确认插件拒绝 shell 内容。
- 构建：运行 `npm run build`。

## 下一步

### M2.8：PDF 语义分段和解析产物复用

- 下载并保存 MinerU `content_list.json`。
- 基于标题层级、页码、表格、公式、图片块做语义分段，而不是只按字符切分。
- 为已保存的 MinerU 解析结果增加复用能力，避免同一个 PDF 重复调用 MinerU。

### M2.9：URL 提取质量

- 改进被阻塞 URL 的用户提示。
- 在预览 UI 或来源区显示 URL 提取方式。
- 考虑把提取诊断写入 Markdown frontmatter。

### M3：工具化 RecallKit Runtime

- 把内部能力整理为显式工具：`fetch_url`、`extract_pdf`、`analyze_content`、`create_card`、`search_vault`、`read_note`。
- 工具结果保持结构化，便于未来 agent 工作流复用。
- 所有最终 vault 写入仍需要用户确认。

### M4：Obsidian Agent Mode

- 增加 agent 风格的多步骤任务界面。
- 让模型在安全工具中选择下一步动作。
- 写入 vault 前展示预览或 diff。

## 开发命令

```powershell
npm install
npm run build
npm run dev
npm run release:stage
```

开发 vault：`g:\01project\recallkit-obsidian-dev-vault`
插件仓库：`g:\01project\obsidian-recallkit-plugin`
