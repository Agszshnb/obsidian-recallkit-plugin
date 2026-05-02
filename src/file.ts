import { App, normalizePath, TFile } from "obsidian";

interface CreateKnowledgeCardOptions {
	app: App;
	folder: string;
	title: string;
	markdown: string;
}

export async function createKnowledgeCard(options: CreateKnowledgeCardOptions): Promise<TFile> {
	const folderPath = normalizePath(options.folder || "RecallKit Cards");
	await ensureFolder(options.app, folderPath);

	const baseName = `${formatDate(new Date())}-${sanitizeFileName(options.title)}`;
	const path = await getAvailablePath(options.app, folderPath, baseName, "md");

	return options.app.vault.create(path, options.markdown);
}

export async function createMarkdownFile(options: {
	app: App;
	folder: string;
	baseName: string;
	markdown: string;
}): Promise<TFile> {
	const folderPath = normalizePath(options.folder || "RecallKit Sources");
	await ensureFolder(options.app, folderPath);

	const path = await getAvailablePath(
		options.app,
		folderPath,
		sanitizeFileName(options.baseName),
		"md",
	);

	return options.app.vault.create(path, options.markdown);
}

export async function ensureFolder(app: App, folderPath: string): Promise<void> {
	const parts = folderPath.split("/").filter(Boolean);
	let current = "";

	for (const part of parts) {
		current = current ? `${current}/${part}` : part;
		if (!app.vault.getAbstractFileByPath(current)) {
			await app.vault.createFolder(current);
		}
	}
}

async function getAvailablePath(
	app: App,
	folderPath: string,
	baseName: string,
	extension: string,
): Promise<string> {
	let candidate = normalizePath(`${folderPath}/${baseName}.${extension}`);

	if (!app.vault.getAbstractFileByPath(candidate)) {
		return candidate;
	}

	for (let index = 2; index < 1000; index += 1) {
		candidate = normalizePath(`${folderPath}/${baseName}-${index}.${extension}`);
		if (!app.vault.getAbstractFileByPath(candidate)) {
			return candidate;
		}
	}

	return normalizePath(`${folderPath}/${baseName}-${Date.now()}.${extension}`);
}

function sanitizeFileName(value: string): string {
	const sanitized = value
		.replace(/[\\/:*?"<>|#^[\]]/g, " ")
		.replace(/\s+/g, " ")
		.trim();

	return sanitized || "untitled";
}

function formatDate(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");

	return `${year}-${month}-${day}`;
}
