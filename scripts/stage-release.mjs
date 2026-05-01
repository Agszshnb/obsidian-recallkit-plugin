import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const releaseDir = join("dist", `recallkit-${manifest.version}`);

rmSync(releaseDir, { recursive: true, force: true });
mkdirSync(releaseDir, { recursive: true });

for (const file of ["manifest.json", "main.js", "styles.css"]) {
	copyFileSync(file, join(releaseDir, file));
}

if (existsSync("prompts")) {
	cpSync("prompts", join(releaseDir, "prompts"), { recursive: true });
}

writeFileSync(
	join(releaseDir, "release-notes.md"),
	[
		`# RecallKit ${manifest.version}`,
		"",
		"Initial Obsidian plugin MVP.",
		"",
		"## Release assets",
		"",
		"Attach these files to the GitHub release. The release tag must exactly match the manifest version, without a leading `v`.",
		"",
		"- `manifest.json`",
		"- `main.js`",
		"- `styles.css`",
		"- `prompts/literature-review.md`",
		"",
		"## Current scope",
		"",
		"- Paste text and generate a structured Markdown knowledge card.",
		"- Enter a URL, extract readable page text with direct fetch plus Jina Reader fallback, and generate a structured Markdown knowledge card.",
		"- Select a text-based PDF from the current vault and generate a literature-style card.",
		"- Use an OpenAI-compatible chat completions endpoint configured by the user.",
		"- Preview and edit Markdown before saving into the vault.",
		"",
		"## Not included yet",
		"",
		"- OCR for scanned PDFs.",
		"- Mobile validation.",
		"",
	].join("\n"),
);

console.log(`Staged RecallKit ${manifest.version} release files in ${releaseDir}`);
