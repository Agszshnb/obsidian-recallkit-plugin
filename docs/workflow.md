# RecallKit 插件 Workflow

最后更新：2026-05-02

## 当前主流程

```mermaid
flowchart TD
    A[用户触发 RecallKit] --> B{打开创建卡片弹窗}
    B --> C[填写我的备注<br/>仅保存到最终卡片]
    C --> D{选择来源类型}

    D -->|文本| E[粘贴文本内容]
    D -->|URL| F[输入 URL]
    D -->|PDF 文献| G[选择 vault 中的 PDF]

    E --> H{选择分析 Prompt 来源}
    F --> F1[规范化 URL]
    F1 --> F2[Obsidian requestUrl 直连抓取]
    F2 --> F3{正文是否可用}
    F3 -->|可用| F4[提取标题和正文]
    F3 -->|失败或太短| F5[Jina Reader fallback]
    F5 --> F6{fallback 内容是否可用}
    F6 -->|可用| F4
    F6 -->|不可用| X[停止并提示用户<br/>改用文本模式或检查来源]
    F4 --> H
    G --> G0{PDF parser}
    G0 -->|Built-in pdf.js| G1[pdf.js text extraction]
    G1 --> G2{Extracted text?}
    G2 -->|yes| H
    G2 -->|no| X2[Stop and suggest MinerU OCR for scanned PDFs]
    G0 -->|MinerU Cloud API| G3[Request signed upload URL and upload PDF]
    G3 --> G4[Poll MinerU batch result]
    G4 --> G5[Download result zip and extract full.md]
    G5 --> G6{Save MinerU Markdown?}
    G6 -->|yes| G7[Write full.md into RecallKit Sources]
    G6 -->|no| H
    G7 --> H

    H -->|内置分析模板| I[选择通用 / 新闻 / 论文 / 社交媒体]
    H -->|vault Markdown prompt| J[选择 vault 中的 .md 提示词文件]
    H -->|现场输入| K[输入本次临时 Prompt]

    I --> L[组装分析输入]
    J --> L
    K --> L

    L --> L1{内容是否超过单次分析阈值}
    L1 -->|否| M[调用 OpenAI-compatible Chat Completions API]
    L1 -->|是| M1[切分长文档并发分段分析]
    M1 --> M2[综合分段结果生成最终卡片]
    M --> N{模型是否返回合法 JSON}
    M2 --> N
    N -->|否| X3[停止并提示模型响应错误]
    N -->|是| O[规范化知识卡片草稿]

    O --> P[按动态 sections 生成 Obsidian Markdown 预览]
    P --> Q{用户预览和编辑}
    Q -->|返回修改| B
    Q -->|保存卡片| R[写入配置的输出文件夹]
    R --> S{创建后自动打开?}
    S -->|是| T[打开新 Markdown 卡片]
    S -->|否| U[完成]
    T --> U
```

## 2026-05-02 PDF parsing update

PDF input has two parser paths:

- Built-in pdf.js: local text extraction for text-based PDFs.
- MinerU Cloud API: signed upload -> batch polling -> result zip download -> `full.md` extraction -> optional vault save -> existing RecallKit card analysis.

## 模块职责

```mermaid
flowchart LR
    UI[modal.ts<br/>输入弹窗与预览] --> Prompt[prompts.ts<br/>内置 / vault / 手动 Prompt]
    UI --> Fetch[fetch.ts<br/>URL 抓取与 Jina fallback]
    UI --> PDF[pdf.ts<br/>PDF 文本提取]
    UI --> LLM[llm.ts<br/>Chat Completions 调用与 JSON 规范化]
    UI --> Markdown[markdown.ts<br/>按 sections 渲染 Markdown 卡片]
    UI --> File[file.ts<br/>vault 写入与防覆盖]
    Settings[settings.ts<br/>API / 模型 / 默认模板 / 输出配置] --> UI
    Settings --> LLM
    Settings --> File
```

## 当前 Prompt 工程流程

```mermaid
flowchart TD
    A[创建卡片弹窗] --> B{Prompt 来源}
    B -->|内置分析模板| C{模板类型}
    C --> C1[通用内容]
    C --> C2[新闻 / 事件]
    C --> C3[论文 / 文献]
    C --> C4[社交媒体]
    B -->|vault Markdown prompt| D[读取用户选择的 .md 文件]
    B -->|现场输入| E[使用临时 Prompt]

    C1 --> F[analysisPrompt]
    C2 --> F
    C3 --> F
    C4 --> F
    D --> F
    E --> F

    F --> G[与来源类型、来源 URL、正文内容一起发送给模型]
    G --> H[模型输出 title / sections / tags / card_type / quality_hint]
    H --> I[规范化 sections，兼容旧字段输出]
    I --> J[转换为 Markdown 知识卡片]
```

## 未来扩展点

```mermaid
flowchart TD
    A[RecallKit 当前 URL 提取] --> B{是否需要高级提取}
    B -->|普通公开网页| C[requestUrl + Jina Reader]
    B -->|动态网页 / 复杂页面 / 批量抓取| D[可选 Crawl4AI 本地服务]
    B -->|社交媒体 / 视频 / GitHub / RSS| E[可选 Agent-Reach 渠道]

    C --> F[统一为纯文本或 Markdown]
    D --> F
    E --> F
    F --> G[RecallKit 分析模板]
    G --> H[知识卡片预览]
    H --> I[用户确认后写入 vault]
```
