# RecallKit Development Progress

Language: [中文](progress.md) | English

Last updated: 2026-05-01
Current version: 0.1.0

## Purpose Of This Document

This document is for the project owner. It answers "what has been built, what is still missing, and what should happen next." It can include milestones, limitations, test scope, and next-stage plans.

- Public GitHub-facing introduction belongs in root `README.md`; keep it focused on what users can understand and use.
- AI handoff context belongs in root `AGENTS.md`; keep it focused on repository structure, commands, implementation constraints, and documentation update rules.
- Flow diagrams and module responsibilities belong in `docs/workflow.md`.
- GitHub source sync and Release upload rules belong in `docs/github-upload-checklist.md`; treat that checklist as the source of truth.

## Current Status

RecallKit is in local MVP development as an Obsidian plugin. The goal is to turn text, web URL content, and text-based PDFs in the vault into structured Markdown knowledge cards.

## Completed

### M0: Text Knowledge Cards

- Create a RecallKit knowledge card from pasted text.
- Call an OpenAI-compatible Chat Completions API.
- Configure API base URL, API key, model, output folder, default tags, and open-after-create behavior.
- Preview and edit generated Markdown before saving.
- Write cards into a configured vault folder while avoiding overwrites.

### M1: PDF Extraction

- List PDF files in the current vault.
- Extract copyable text from text-based PDFs.
- Add PDF path, page count, and truncation hints to the analysis input.
- Keep scanned PDF OCR out of scope for the current stage.

### M2: URL Extraction

- Add URL mode to the RecallKit input modal.
- Normalize URLs and automatically add `https://` when omitted.
- Fetch web pages through Obsidian `requestUrl`.
- Extract titles and article-like body text from HTML.
- Support plain text, JSON, XML, and Markdown-like URL responses.
- Write URL source metadata into generated card frontmatter.

### M2.1: Agent-Reach Inspired URL Fallback

- Implement two-step extraction: direct request first, Jina Reader fallback second.
- Automatically try Jina Reader when direct fetch fails or returns too little readable text.
- Mark extraction method as `direct request` or `Jina Reader fallback`.
- Detect `403` warnings returned by Jina Reader.
- Detect login, anti-bot, and shell pages before sending content to the model.
- Add guards for common Zhihu shell pages, including welcome, security verification, and "knowledge desert" responses.
- Document Jina Reader fallback and privacy implications in README.

### M2.2: Built-in Analysis Template Switching

- Expand the default literature review prompt into switchable built-in analysis templates.
- First built-in templates: general content, news/events, papers/literature, and social media.
- Add a default built-in analysis template setting.
- Allow the create-card modal to switch the built-in analysis template for the current card.
- Keep vault Markdown prompts and manual prompts available.

### M2.3: Long Document Analysis and Progress Feedback

- Analyze short content in a single model call, and automatically split long content into chunks before synthesizing the final card.
- Current chunking uses about 20,000 characters per chunk, concurrency of 2, and a 500,000-character total input safety limit.
- Add analysis progress feedback in the create-card modal for preparing content, single-pass analysis, chunking, chunk analysis, synthesis, and preview generation.
- Add truncation hints for long URL and PDF inputs before sending them to the model, so `quality_hint` can describe content completeness.
- Make model JSON parsing more tolerant by stripping code fences and extracting a JSON object from the response when possible.

### M2.4: Release Asset Staging

- `npm run release:stage` now runs a production build and stages release files under `dist/recallkit-0.1.0/`.
- Staged release assets include `manifest.json`, `main.js`, `styles.css`, and `prompts/literature-review.md`.
- `prompts/literature-review.md` ships as the bundled literature review template for manual installs; if it is not copied, the plugin still uses the code-level fallback prompt.

### M2.5: Dynamic Card Sections

- Final model output now uses a dynamic `sections` array instead of the fixed `summary`, `core_points`, `key_arguments`, and `specific_actions` card body.
- Each section supports `title`, `content`, and `items`, allowing the model to choose 3-6 content-specific sections.
- Markdown rendering now builds second-level headings from `sections`, so cards no longer have to follow the same Summary / Key Ideas / Evidence / Actions structure.
- Legacy field compatibility remains: if a model or older prompt returns the old fields, RecallKit converts them into sections instead of failing the flow.

## Known Limits

- Sites with strong anti-bot behavior, such as Zhihu, may block both direct fetch and Jina Reader.
- Login-gated pages are not automatically supported. Users should copy the page body and use text mode.
- Heavy JavaScript-rendered pages may return shell or incomplete content.
- OCR for scanned PDFs is not implemented.
- Mobile behavior has not been validated.
- URL extraction is best-effort. Users should review the preview before saving generated cards.

## Recommended Manual Tests

- Text mode: paste a short article and generate a knowledge card.
- PDF mode: select a text-based PDF from the development vault.
- Direct URL mode: test `https://example.com`.
- Article URL mode: test a public article page, such as `https://www.paulgraham.com/greatwork.html`.
- URL fallback mode: test a page where direct fetch fails but Jina Reader can read the content.
- URL blocked mode: test `https://zhuanlan.zhihu.com/p/27327515233` and confirm RecallKit refuses shell content instead of generating a misleading card.
- Scholarly page mode: test `https://www.sciencedirect.com/science/article/pii/S0038012125002411`.

## Next Milestones

### M2.6: URL Extraction Quality

- Improve user-facing messages for blocked URLs.
- Show extraction method in the preview UI or source section.
- Consider writing extraction diagnostics into Markdown frontmatter.
- Add site-specific extractors only when they are safe and do not require default authentication.

### M3: Toolized RecallKit Runtime

- Convert internal capabilities into explicit tools:
  - `fetch_url`
  - `extract_pdf`
  - `analyze_content`
  - `create_card`
  - `search_vault`
  - `read_note`
- Keep tool results structured so future agent workflows can reuse them.
- Require user confirmation for all vault write operations.

### M4: Obsidian Agent Mode

- Add an agent-style multi-step task interface.
- Let the model choose the next action from safe RecallKit tools.
- Show a preview or diff before writing to the vault.
- Keep external CLI, cookie-based, and browser automation capabilities optional, desktop-only, and explicitly user-enabled.

## Development Notes

- Build command: `npm run build`
- Development watch command: `npm run dev`
- Development vault: `g:\01project\recallkit-obsidian-dev-vault`
- Plugin repository: `g:\01project\obsidian-recallkit-plugin`
