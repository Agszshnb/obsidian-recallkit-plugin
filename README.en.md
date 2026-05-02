# RecallKit

Language: [中文](README.md) | English

RecallKit is an Obsidian plugin for turning pasted text, web pages, and PDFs in your vault into structured Markdown knowledge cards. It helps readers, researchers, product managers, and knowledge workers capture useful material into an editable Obsidian workflow.

It is useful for:

- Summarizing articles, reports, papers, and long-form social posts.
- Converting web content into searchable, linkable Obsidian notes.
- Creating consistent knowledge cards for product research, competitor analysis, industry news, and reference archives.
- Reviewing and editing AI-generated drafts before saving them to a vault.

## Highlights

- **Text to card**: Paste text and generate a structured Markdown knowledge card.
- **URL to card**: Enter a web page URL and parse it into Markdown with MinerU Cloud API, or use the legacy direct/Jina extractor.
- **PDF to card**: Select a PDF from the current vault and parse it with either built-in pdf.js or MinerU Cloud API.
- **MinerU source capture**: Optionally save MinerU `full.md` results into the current vault under `RecallKit Sources`; PDF result images are saved beside the source note as vault-readable assets.
- **Analysis templates**: Use built-in templates for general content, news/events, papers/literature, and social media.
- **Custom prompts**: Choose a Markdown prompt from your vault or write a prompt directly in the modal.
- **Long-document chunking**: Short content uses one model call, while long URL, PDF, or text inputs are chunked, analyzed in parts, and synthesized into one final card.
- **Single-pass analysis limit**: Configure how much content can be sent to the LLM in one request. If content exceeds the limit, RecallKit asks before switching to chunked analysis.
- **Preview before saving**: Review and edit generated Markdown before it is written to your vault.
- **Organized output**: Save cards into a configurable folder while avoiding filename overwrites.
- **Flexible model setup**: Use an OpenAI-compatible Chat Completions API, with DeepSeek-oriented defaults.

## How To Use

1. Open **Settings > Community plugins > RecallKit** in Obsidian.
2. Enter your API base URL, API key, and model name, such as `https://api.deepseek.com` and `deepseek-chat`.
3. Configure URL parsing. MinerU Cloud API requires a MinerU token and converts web pages to Markdown; Direct / Jina Reader keeps the legacy extractor.
4. Configure PDF parsing. Built-in pdf.js is local and text-only; MinerU Cloud API requires a MinerU token and supports OCR, tables, formulas, and complex layouts.
5. Configure the single-pass analysis limit, default analysis template, output folder, and default tags.
6. Click the RecallKit ribbon icon, or run **Create knowledge card** from the command palette.
7. Choose an input source: pasted text, a web page URL, or a PDF from your vault.
8. Select an analysis template, or switch to a custom prompt.
9. Click **Analyze**, review the generated card, edit it if needed, and save it to your vault.

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

When you click **Analyze**, the plugin sends the selected text, extracted web page text, or parsed PDF Markdown to the OpenAI-compatible API endpoint configured in settings. Your model API key is stored locally through Obsidian plugin data and is not written into generated Markdown cards.

For PDFs, RecallKit reads only the file you select from the current vault. If the PDF parser is set to MinerU Cloud API, the selected PDF is uploaded to MinerU for parsing, then RecallKit downloads the MinerU result zip and uses `full.md` for card generation. The MinerU API token is stored locally and is not written into generated cards.

When enabled in settings, RecallKit also saves the MinerU `full.md` result into the current vault. The default folder is `RecallKit Sources`. For PDF results, images referenced as `images/...` are saved into a same-name assets folder, and the Markdown image links are rewritten to vault-relative paths.

For URLs, RecallKit defaults to MinerU Cloud API with the `MinerU-HTML` model. It submits the URL to MinerU, downloads the result zip, extracts `full.md`, and sends that Markdown to your configured model service. If you switch URL parsing to **Direct / Jina Reader**, RecallKit uses the legacy direct request first and Jina Reader (`https://r.jina.ai/`) as fallback.

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
