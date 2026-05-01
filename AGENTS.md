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
- URL extraction uses direct `requestUrl` first, then Jina Reader fallback when direct extraction fails or returns too little readable text.
- Long content is analyzed with a single pass up to 90,000 characters; longer content is split into about 20,000-character chunks, analyzed with concurrency 2, then synthesized.
- Card body output uses dynamic `sections` with `title`, `content`, and `items`; legacy `summary/core_points/key_arguments/specific_actions` responses are normalized into sections for compatibility.
- PDF extraction uses `pdfjs-dist` and supports text-based PDFs only. OCR for scanned PDFs is not implemented.
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
- All vault writes must remain user-confirmed through the preview/save flow.
- Treat URL extraction as best-effort. Do not promise authenticated pages, heavy JavaScript pages, or anti-bot-protected sites will work.
- Keep external CLI, cookies, browser automation, and local services out of the default MVP path.

## Documentation Update Rules

- User-visible feature or install behavior changed: update `README.md` and `README.en.md`.
- Project phase, completed milestones, limitations, tests, or next plan changed: update `docs/progress.md` and `docs/progress.en.md`.
- Agent-facing repo facts, commands, guardrails, or current implementation constraints changed: update this `AGENTS.md`.
- Flow, state machine, or module responsibility changed: update `docs/workflow.md`.
- GitHub source sync scope or release asset rules changed: update `docs/github-upload-checklist.md` first, then update any README or script references that would become stale.
