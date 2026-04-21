# RecallKit

RecallKit is an Obsidian plugin that turns pasted text or text-based PDFs in your vault into structured Markdown knowledge cards.

This is the first MVP release. It is intended for local testing, GitHub release distribution, and early user feedback before applying to the official Obsidian community plugin list.

## Features

- Create a knowledge card from pasted text.
- Select a PDF from the current vault and extract copyable text for analysis.
- Use an OpenAI-compatible chat completions endpoint, with DeepSeek defaults.
- Choose a built-in, vault Markdown, or manual analysis prompt.
- Preview and edit the generated Markdown before saving.
- Save cards into a configurable vault folder without overwriting existing files.

## Current limits

- URL content extraction is not implemented yet. Use text mode and paste the page content manually.
- Scanned PDFs need OCR and are not supported in this release.
- The plugin has only been manually tested in a desktop development vault.
- Generated cards are AI drafts. Review them before keeping or reusing them.

## Privacy and network use

RecallKit does not include telemetry, ads, or a RecallKit cloud service.

When you click **Analyze**, the plugin sends the selected text or extracted PDF text to the OpenAI-compatible API endpoint configured in settings. Your API key is stored in local Obsidian plugin data through `loadData()` and `saveData()`. The key is not written into generated Markdown cards.

For PDFs, RecallKit lists files in the current vault and reads only the PDF file you select.

## Development

Use a dedicated development vault instead of your main vault.

```powershell
cd obsidian-plugin
npm install
npm run dev
```

In this workspace, the local development vault is:

```text
g:\01project\recallkit-obsidian-dev-vault
```

Its plugin path is a junction to this source directory:

```text
g:\01project\recallkit-obsidian-dev-vault\.obsidian\plugins\recallkit
  -> g:\01project\recallkit\obsidian-plugin
```

Reload Obsidian after builds and enable **RecallKit** in community plugin settings.

## Build

```powershell
npm run build
```

The production build writes `main.js` in this directory. The PDF.js worker is bundled into `main.js`, so the release follows Obsidian's standard three-file asset set.

## Manual installation

Build the plugin, then copy these files into:

```text
VaultFolder/.obsidian/plugins/recallkit/
```

Required files:

- `manifest.json`
- `main.js`
- `styles.css`

Then enable **RecallKit** in Obsidian.

## Release staging

```powershell
npm run release:stage
```

This builds the plugin and stages GitHub release files under:

```text
obsidian-plugin/dist/recallkit-0.1.0/
```

Attach these files to the GitHub release:

- `manifest.json`
- `main.js`
- `styles.css`

The GitHub release tag must exactly match `manifest.json` version, for example `0.1.0` without a leading `v`.

## Official community plugin submission notes

Obsidian community plugin installation reads `manifest.json` and `README.md` from the repository root, then downloads `manifest.json`, `main.js`, and `styles.css` from the matching GitHub release.

If this plugin is submitted to the official community list, publish `obsidian-plugin/` as the plugin repository root or move/copy the plugin release metadata to the repository root before submitting.
