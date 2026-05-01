# RecallKit

Language: [中文](README.md) | English

RecallKit is an Obsidian plugin for turning pasted text, web pages, and text-based PDFs in your vault into structured Markdown knowledge cards. It helps readers, researchers, product managers, and knowledge workers capture useful material into an editable Obsidian workflow.

It is useful for:

- Summarizing articles, reports, papers, and long-form social posts.
- Converting web content into searchable, linkable Obsidian notes.
- Creating consistent knowledge cards for product research, competitor analysis, industry news, and reference archives.
- Reviewing and editing AI-generated drafts before saving them to a vault.

## Highlights

- **Text to card**: Paste text and generate a structured Markdown knowledge card.
- **URL to card**: Enter a web page URL and extract readable page content for analysis.
- **PDF to card**: Select a text-based PDF from the current vault and turn extracted text into a card.
- **Analysis templates**: Use built-in templates for general content, news/events, papers/literature, and social media.
- **Custom prompts**: Choose a Markdown prompt from your vault or write a prompt directly in the modal.
- **Long-document chunking**: Short content uses one model call, while long URL, PDF, or text inputs are chunked, analyzed in parts, and synthesized into one final card.
- **Preview before saving**: Review and edit generated Markdown before it is written to your vault.
- **Organized output**: Save cards into a configurable folder while avoiding filename overwrites.
- **Flexible model setup**: Use an OpenAI-compatible Chat Completions API, with DeepSeek-oriented defaults.

## How To Use

1. Open **Settings > Community plugins > RecallKit** in Obsidian.
2. Enter your API base URL, API key, and model name, such as `https://api.deepseek.com` and `deepseek-chat`.
3. Configure the default analysis template, output folder, and default tags.
4. Click the RecallKit ribbon icon, or run **Create knowledge card / 创建知识卡片** from the command palette.
5. Choose an input source: pasted text, a web page URL, or a PDF from your vault.
6. Select an analysis template, or switch to a custom prompt.
7. Click **Analyze**, review the generated card, edit it if needed, and save it to your vault.

## Card Output

RecallKit saves model output as Markdown so it works naturally with Obsidian links, tags, search, and folder organization. A typical card can include:

- Summary and key ideas.
- Important facts, people, timelines, or data points.
- Review questions and possible next actions.
- Source information, tags, and creation time.

The exact structure depends on the selected template and any custom prompt you provide.

## Installation

RecallKit can be installed manually from GitHub Releases:

1. Download `manifest.json`, `main.js`, `styles.css`, and `prompts/literature-review.md` from the release assets.
2. Create this plugin folder in your vault:

```text
VaultFolder/.obsidian/plugins/recallkit/
```

3. Place the first three files in that folder, and keep `prompts/literature-review.md` at the same relative path.
4. Restart Obsidian, open **Settings > Community plugins**, and enable **RecallKit**.

## Privacy And Network Use

RecallKit does not include telemetry, ads, or a RecallKit cloud service.

When you click **Analyze**, the plugin sends the selected text, extracted web page text, or extracted PDF text to the OpenAI-compatible API endpoint configured in settings. Your API key is stored locally through Obsidian plugin data and is not written into generated Markdown cards.

For PDFs, RecallKit reads only the file you select from the current vault.

For URLs, RecallKit requests the page you enter and extracts readable text. If direct extraction is not suitable, it uses Jina Reader (`https://r.jina.ai/`) to obtain cleaner Markdown content, then sends the extracted text to your configured model service.

## Project Status

RecallKit 0.1.0 includes the core knowledge-card workflow: input selection, analysis template selection, long-document chunking, model generation, preview editing, and saving to an Obsidian vault. Future work will continue around URL extraction quality, smoother installation, and official Obsidian community plugin distribution.

Maintainers can read [`docs/progress.md`](docs/progress.md) for detailed development progress. AI agents should read [`AGENTS.md`](AGENTS.md) before working in this repository.
GitHub source sync and Release upload rules are documented in [`docs/github-upload-checklist.md`](docs/github-upload-checklist.md).

## Development

This project is built with TypeScript and follows the standard Obsidian plugin structure.

```powershell
npm install
npm run build
```

The build produces `main.js` for Obsidian. Release assets include:

- `manifest.json`
- `main.js`
- `styles.css`
- `prompts/literature-review.md`
