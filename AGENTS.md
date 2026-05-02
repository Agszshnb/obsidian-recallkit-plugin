# RecallKit Agent Context

This file is for AI coding agents working inside this repository. It is not the public project README and not the owner's progress journal.

## Documentation Roles

- `README.md` / `README.en.md`: public GitHub-facing introduction. Keep it user-oriented: what the plugin does, how to install it, privacy/network behavior, and basic development commands. Do not put internal task history or agent-only notes here.
- `docs/progress.md` / `docs/progress.en.md`: owner-facing progress record. Use it to summarize milestones, current limitations, manual test scope, and next-stage plans in chronological product terms.
- `AGENTS.md`: agent-facing handoff. Keep it concise and operational: repo structure, current implementation facts, commands, guardrails, and where to update docs after code changes.
- `docs/workflow.md`: implementation workflow diagrams. Update it when the product flow, module responsibilities, or analysis pipeline changes.
- `docs/github-upload-checklist.md`: single source of truth for daily GitHub source sync and GitHub Release asset upload rules.

## Current State

- Version: `0.1.0`.
- Repository path: `g:\01project\obsidian-recallkit-plugin`.
- Development vault: `g:\01project\recallkit-obsidian-dev-vault`.
- Core workflow: text, URL, or vault PDF input -> prompt selection -> OpenAI-compatible Chat Completions analysis -> Markdown preview -> vault write.
- URL extraction defaults to MinerU Cloud API with `model_version: "MinerU-HTML"`, which submits the remote URL through `/api/v4/extract/task`, polls `/api/v4/extract/task/{task_id}`, downloads the result zip, extracts `full.md`, and passes that Markdown into the card analysis pipeline. The legacy direct `requestUrl` + Jina Reader fallback remains available through the `urlParser` setting.
- Long content is analyzed in a single pass up to the configured `singlePassCharLimit` (default 200,000 characters). If content exceeds that limit, the modal asks the user to confirm before switching to chunked analysis. Confirmed chunking uses about 20,000-character chunks, concurrency 2, then synthesizes the final card.
- Card body output uses dynamic `sections` with `title`, `content`, and `items`; legacy `summary/core_points/key_arguments/specific_actions` responses are normalized into sections for compatibility.
- PDF extraction can use built-in `pdfjs-dist` or MinerU Cloud API. MinerU Cloud uploads the selected vault PDF through the signed upload URL flow, polls the batch result endpoint, downloads the result zip, extracts `full.md`, and passes that Markdown into the existing card analysis pipeline.
- MinerU `full.md` is saved into the current vault when `mineruSaveMarkdown` is enabled. Default folder: `RecallKit Sources`. PDF result images referenced from `images/...` are saved into a same-name assets folder and Markdown image links are rewritten to vault-relative paths.
- Built-in pdf.js remains a local fallback and supports text-based PDFs only. Scanned PDF OCR requires MinerU Cloud with OCR enabled.
- MinerU Cloud settings live in `src/settings.ts`: URL parser choice, PDF parser choice, API token, model version, OCR/table/formula flags, language, and polling timeout. Do not write MinerU tokens into generated Markdown cards.
- Release staging copies `manifest.json`, `main.js`, `styles.css`, and `prompts/literature-review.md` into `dist/recallkit-<version>/`.
- GitHub upload and release rules are centralized in `docs/github-upload-checklist.md`.

## Commands

```powershell
npm install
npm run build
npm run dev
npm run release:stage
```

## Implementation Guardrails

- Keep all API providers OpenAI-compatible for this version.
- Do not write API keys into generated Markdown cards.
- User notes are saved only into the final card; they must not be sent to the model.
- Final knowledge-card vault writes must remain user-confirmed through the preview/save flow.
- MinerU intermediate Markdown and referenced asset writes are allowed only when the user has enabled `mineruSaveMarkdown`; keep them limited to the configured `mineruOutputFolder` and the generated source note's same-name assets folder.
- Treat URL extraction as best-effort even with MinerU-HTML. Do not promise authenticated pages, heavy JavaScript pages, or anti-bot-protected sites will work.
- Keep external CLI, cookies, browser automation, and local services out of the default MVP path.

## Documentation Update Rules

- User-visible feature or install behavior changed: update `README.md` and `README.en.md`.
- Project phase, completed milestones, limitations, tests, or next plan changed: update `docs/progress.md` and `docs/progress.en.md`.
- Agent-facing repo facts, commands, guardrails, or current implementation constraints changed: update this `AGENTS.md`.
- Flow, state machine, or module responsibility changed: update `docs/workflow.md`.
- GitHub source sync scope or release asset rules changed: update `docs/github-upload-checklist.md` first, then update any README or script references that would become stale.
