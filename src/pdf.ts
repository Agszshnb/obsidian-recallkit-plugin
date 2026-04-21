import { App, TFile } from "obsidian";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorkerSource from "pdfjs-worker";

const MAX_PDF_TEXT_CHARS = 30000;

export interface PdfExtractionResult {
	path: string;
	pageCount: number;
	text: string;
	truncated: boolean;
}

export async function extractTextFromVaultPdf(app: App, path: string): Promise<PdfExtractionResult> {
	const file = app.vault.getFileByPath(path);

	if (!(file instanceof TFile) || file.extension.toLowerCase() !== "pdf") {
		throw new Error("请选择 vault 中的 PDF 文件。");
	}

	configurePdfWorker();

	const buffer = await app.vault.readBinary(file);
	const loadingTask = getDocument({
		data: new Uint8Array(buffer),
		isEvalSupported: false,
		useWorkerFetch: false,
	});
	const pdf = await loadingTask.promise;
	const pageCount = pdf.numPages;
	const chunks: string[] = [];
	let totalLength = 0;
	let truncated = false;

	for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
		const page = await pdf.getPage(pageNumber);
		const content = await page.getTextContent();
		const pageText = content.items
			.map((item) => {
				if (typeof item === "object" && item !== null && "str" in item) {
					const value = item.str;
					return typeof value === "string" ? value : "";
				}
				return "";
			})
			.join(" ")
			.replace(/\s+/g, " ")
			.trim();

		if (!pageText) {
			continue;
		}

		const labeledText = `第 ${pageNumber} 页：\n${pageText}`;
		chunks.push(labeledText);
		totalLength += labeledText.length;

		if (totalLength >= MAX_PDF_TEXT_CHARS) {
			truncated = true;
			break;
		}
	}

	await pdf.destroy();

	const text = chunks.join("\n\n").slice(0, MAX_PDF_TEXT_CHARS);
	if (!text.trim()) {
		throw new Error("没有从这个 PDF 中提取到可分析文字。扫描版 PDF 需要 OCR，当前版本暂不支持。");
	}

	return {
		path: file.path,
		pageCount,
		text,
		truncated,
	};
}

function configurePdfWorker(): void {
	if (GlobalWorkerOptions.workerSrc) {
		return;
	}

	const workerBlob = new Blob([pdfWorkerSource], { type: "text/javascript" });
	GlobalWorkerOptions.workerSrc = URL.createObjectURL(workerBlob);
}
