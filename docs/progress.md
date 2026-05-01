# RecallKit 开发进度

语言：中文 | [English](progress.en.md)

最后更新：2026-05-01
当前版本：0.1.0

## 这份文档的用途

这份文档给项目所有者看，用来回答“现在做到哪一步、还缺什么、下一步做什么”。它可以记录阶段、限制、测试样本和后续计划。

- GitHub 访客看的公开介绍放在根目录 `README.md`，那里只写用户能理解和使用的信息。
- AI 接手项目看的操作上下文放在根目录 `AGENTS.md`，那里只写仓库结构、命令、实现约束和文档更新规则。
- 流程图和模块关系放在 `docs/workflow.md`。
- GitHub 源码同步和 Release 上传规则放在 `docs/github-upload-checklist.md`，以后以这份清单为准。

## 当前状态

RecallKit 目前处于 Obsidian 插件本地 MVP 开发阶段。目标是把文本、URL 网页内容、以及 vault 中的文本型 PDF 转换成结构化 Markdown 知识卡片。

## 已完成

### M0：文本知识卡片

- 支持从粘贴文本创建 RecallKit 知识卡片。
- 支持调用 OpenAI-compatible Chat Completions API。
- 支持配置 API base URL、API Key、模型、输出文件夹、默认标签、创建后自动打开。
- 支持在保存前预览和编辑生成的 Markdown。
- 支持写入指定 vault 文件夹，并避免覆盖已有文件。

### M1：PDF 提取

- 支持列出当前 vault 中的 PDF 文件。
- 支持从文本型 PDF 中提取可复制文字。
- 支持把 PDF 路径、页数、截断提示加入分析输入。
- 扫描版 PDF 的 OCR 暂不纳入当前阶段。

### M2：URL 提取

- 在 RecallKit 输入弹窗中加入 URL 模式。
- 支持 URL 规范化，用户省略 `https://` 时自动补齐。
- 支持通过 Obsidian `requestUrl` 抓取网页。
- 支持从 HTML 中提取标题和文章类正文。
- 支持纯文本、JSON、XML、Markdown 类 URL 响应。
- 支持把 URL 来源写入生成卡片的 frontmatter。

### M2.1：借鉴 Agent-Reach 的 URL fallback

- 实现“直连抓取优先，Jina Reader fallback 其次”的两段式提取。
- 当直连失败或正文太短时，自动尝试 Jina Reader。
- 标记提取方式：`direct request` 或 `Jina Reader fallback`。
- 识别 Jina Reader 返回的 `403` warning。
- 在内容进入模型前，检测登录页、反爬页、空壳页。
- 针对知乎常见壳页面做了检测，包括欢迎页、安全验证页、knowledge desert 页面。
- README 中补充了 Jina Reader fallback 和隐私说明。

### M2.2：内置分析模板切换

- 将默认文献综述 prompt 扩展为可切换的内置分析模板。
- 首批内置模板包括：通用内容、新闻 / 事件、论文 / 文献、社交媒体。
- 在设置页增加默认内置分析模板配置。
- 在创建卡片弹窗中支持按本次内容临时切换内置分析模板。
- 继续保留 vault Markdown prompt 和现场输入 prompt。

### M2.3：长文档分析与进度反馈

- 支持短内容单次模型分析，长内容自动切分后分段分析，再综合生成最终知识卡片。
- 当前分段策略为约 20,000 字符一段，并发分析数为 2，总输入安全上限为 500,000 字符。
- 在创建卡片弹窗中加入分析进度反馈，区分准备内容、单次分析、切分、分段分析、综合结果和生成预览。
- 长 URL / PDF 输入会在进入模型前加入截断提示，要求模型在 `quality_hint` 中说明信息完整性。
- 模型 JSON 解析增加容错：可以清理代码块包裹，也可以从响应中提取 JSON 对象。

### M2.4：发布资产整理

- `npm run release:stage` 会先执行生产构建，再把 release 文件暂存到 `dist/recallkit-0.1.0/`。
- Release 暂存资产包括 `manifest.json`、`main.js`、`styles.css` 和 `prompts/literature-review.md`。
- `prompts/literature-review.md` 会作为内置文献综述模板随手动安装包分发；如果用户没有复制该文件，插件仍会使用代码内置 fallback。

### M2.5：动态知识卡片结构

- 模型最终输出从固定的 `summary`、`core_points`、`key_arguments`、`specific_actions` 四段结构，调整为动态 `sections` 数组。
- 每个 section 支持 `title`、`content` 和 `items`，由模型根据内容类型自拟 3-6 个贴合原文的栏目。
- Markdown 渲染层按 `sections` 动态生成二级标题，避免所有卡片都机械套用“摘要 / 核心观点 / 关键论据 / 具体做法”。
- 保留旧字段兼容逻辑：如果模型或旧 prompt 仍返回旧字段，会自动转换为旧四段 sections，避免生成流程中断。

## 已知限制

- 知乎等反爬较强的网站，可能同时阻止直连和 Jina Reader。
- 需要登录的页面暂不支持自动抓取，建议用户复制正文后使用文本模式。
- 强 JavaScript 渲染页面可能只返回空壳或不完整内容。
- 扫描版 PDF OCR 尚未实现。
- 移动端尚未验证。
- URL 提取仍然是 best-effort，生成卡片前必须检查预览内容。

## 推荐手动测试

- 文本模式：粘贴一段短文章，生成知识卡片。
- PDF 模式：选择开发 vault 中的文本型 PDF。
- URL 直连模式：测试 `https://example.com`。
- URL 文章模式：测试公开文章页，例如 `https://www.paulgraham.com/greatwork.html`。
- URL fallback 模式：测试直连失败但 Jina Reader 可读的页面。
- URL 拦截模式：测试 `https://zhuanlan.zhihu.com/p/27327515233`，确认插件拒绝空壳内容，而不是生成误导性卡片。
- 学术页面模式：测试 `https://www.sciencedirect.com/science/article/pii/S0038012125002411`。

## 下一阶段计划

### M2.6：URL 提取质量增强

- 优化被阻止 URL 的用户提示。
- 在预览界面或来源区展示提取方式。
- 考虑把抓取诊断信息写入 Markdown frontmatter。
- 只在安全且无需默认认证的情况下增加站点专用 extractor。

### M3：RecallKit 能力工具化

- 把内部能力拆成明确工具：
  - `fetch_url`
  - `extract_pdf`
  - `analyze_content`
  - `create_card`
  - `search_vault`
  - `read_note`
- 保持工具结果结构化，方便未来 agent workflow 复用。
- 所有写入 vault 的操作都必须经过用户确认。

### M4：Obsidian Agent 模式

- 增加 agent 风格的多步骤任务界面。
- 允许模型从安全的 RecallKit 工具中选择下一步动作。
- 写入 vault 前展示预览或 diff。
- 外部 CLI、cookie、浏览器自动化类能力必须保持可选、桌面端限定、用户主动开启。

## 开发备注

- 构建命令：`npm run build`
- 开发监听：`npm run dev`
- 开发 vault：`g:\01project\recallkit-obsidian-dev-vault`
- 插件仓库：`g:\01project\obsidian-recallkit-plugin`
