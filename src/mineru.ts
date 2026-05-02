import { App, requestUrl, TFile } from "obsidian";
import { RecallKitSettings } from "./settings";
import { readTextFileFromZip } from "./zip";

const MINERU_API_BASE_URL = "https://mineru.net";
const DEFAULT_POLL_INTERVAL_MS = 3000;
const RESULT_DOWNLOAD_TIMEOUT_MS = 120000;
const RESULT_EXTRACT_TIMEOUT_MS = 60000;

export interface MinerUParseResult {
	path: string;
	text: string;
	parseMethod: "mineru-cloud";
	taskState: string;
	savedMarkdownPath?: string;
}

interface MinerUApiResponse<T> {
	code?: number;
	msg?: string;
	data?: T;
}

interface MinerUUploadUrlData {
	batch_id?: string;
	file_urls?: string[];
}

interface MinerUBatchResultData {
	batch_id?: string;
	extract_result?: MinerUExtractResult[];
}

interface MinerUExtractResult {
	file_name?: string;
	state?: string;
	err_msg?: string;
	full_zip_url?: string;
	extract_progress?: {
		extracted_pages?: number;
		total_pages?: number;
	};
}

interface MinerUProgress {
	stage: "preparing";
	message: string;
	current?: number;
	total?: number;
}

export async function parseVaultPdfWithMinerUCloud(options: {
	app: App;
	path: string;
	settings: RecallKitSettings;
	onProgress?: (progress: MinerUProgress) => void;
}): Promise<MinerUParseResult> {
	const token = options.settings.mineruApiToken.trim();
	if (!token) {
		throw new Error("尚未配置 MinerU API Token。请先在 RecallKit 设置中填写 Token。");
	}

	const file = options.app.vault.getFileByPath(options.path);
	if (!(file instanceof TFile) || file.extension.toLowerCase() !== "pdf") {
		throw new Error("请从当前 vault 中选择一个 PDF 文件。");
	}

	options.onProgress?.({
		stage: "preparing",
		message: "正在向 MinerU 请求上传地址。",
	});
	const uploadData = await requestMinerUUploadUrl({
		token,
		file,
		settings: options.settings,
	});
	const uploadUrl = uploadData.file_urls?.[0];
	const batchId = uploadData.batch_id;
	if (!uploadUrl || !batchId) {
		throw new Error("MinerU 没有返回可用的上传地址。");
	}

	options.onProgress?.({
		stage: "preparing",
		message: "正在上传 PDF 到 MinerU。",
	});
	const pdfBuffer = await options.app.vault.readBinary(file);
	await uploadFileToMinerU(uploadUrl, pdfBuffer);

	options.onProgress?.({
		stage: "preparing",
		message: "正在等待 MinerU 解析 PDF。",
	});
	const result = await pollMinerUBatchResult({
		token,
		batchId,
		timeoutMs: Math.max(options.settings.mineruPollTimeoutSeconds, 30) * 1000,
		onProgress: options.onProgress,
	});

	if (!result.full_zip_url) {
		throw new Error("MinerU 已完成任务，但没有返回结果压缩包地址。");
	}

	options.onProgress?.({
		stage: "preparing",
		message: "正在下载 MinerU 解析结果压缩包。",
	});
	const zipData = await withTimeout(
		downloadArrayBuffer(result.full_zip_url),
		RESULT_DOWNLOAD_TIMEOUT_MS,
		"下载 MinerU 解析结果压缩包超时。可能是 MinerU CDN 访问较慢或当前网络受阻，请稍后重试。",
	);

	options.onProgress?.({
		stage: "preparing",
		message: "正在从 MinerU 结果压缩包中提取 full.md。",
	});
	const markdown = await withTimeout(
		readTextFileFromZip(zipData, "full.md"),
		RESULT_EXTRACT_TIMEOUT_MS,
		"从 MinerU 结果压缩包中提取 full.md 超时。",
	);
	const trimmed = markdown.trim();
	if (!trimmed) {
		throw new Error("MinerU 返回的 Markdown 结果为空。");
	}

	return {
		path: file.path,
		text: trimmed,
		parseMethod: "mineru-cloud",
		taskState: result.state ?? "done",
	};
}

async function requestMinerUUploadUrl(options: {
	token: string;
	file: TFile;
	settings: RecallKitSettings;
}): Promise<MinerUUploadUrlData> {
	const response = await requestUrl({
		url: `${MINERU_API_BASE_URL}/api/v4/file-urls/batch`,
		method: "POST",
		headers: {
			"Authorization": `Bearer ${options.token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			files: [
				{
					name: options.file.name,
					data_id: buildDataId(options.file.path),
					is_ocr: options.settings.mineruEnableOcr,
				},
			],
			model_version: options.settings.mineruModelVersion,
			enable_formula: options.settings.mineruEnableFormula,
			enable_table: options.settings.mineruEnableTable,
			language: options.settings.mineruLanguage || "ch",
		}),
	});

	const data = response.json as MinerUApiResponse<MinerUUploadUrlData>;
	if (data.code !== 0 || !data.data) {
		throw new Error(data.msg || "请求 MinerU 上传地址失败。");
	}

	return data.data;
}

async function uploadFileToMinerU(uploadUrl: string, fileData: ArrayBuffer): Promise<void> {
	const response = await requestUrl({
		url: uploadUrl,
		method: "PUT",
		body: fileData,
	});

	if (response.status < 200 || response.status >= 300) {
		throw new Error(`上传 PDF 到 MinerU 失败，状态码：${response.status}。`);
	}
}

async function pollMinerUBatchResult(options: {
	token: string;
	batchId: string;
	timeoutMs: number;
	onProgress?: (progress: MinerUProgress) => void;
}): Promise<MinerUExtractResult> {
	const startedAt = Date.now();

	while (Date.now() - startedAt < options.timeoutMs) {
		const response = await requestUrl({
			url: `${MINERU_API_BASE_URL}/api/v4/extract-results/batch/${options.batchId}`,
			method: "GET",
			headers: {
				"Authorization": `Bearer ${options.token}`,
				"Accept": "*/*",
			},
		});
		const payload = response.json as MinerUApiResponse<MinerUBatchResultData>;
		if (payload.code !== 0 || !payload.data) {
			throw new Error(payload.msg || "查询 MinerU 任务结果失败。");
		}

		const result = payload.data.extract_result?.[0];
		if (!result) {
			await delay(DEFAULT_POLL_INTERVAL_MS);
			continue;
		}

		if (result.state === "done") {
			return result;
		}

		if (result.state === "failed") {
			throw new Error(result.err_msg || "MinerU PDF 解析失败。");
		}

		const progress = result.extract_progress;
		options.onProgress?.({
			stage: "preparing",
			message: readMinerUStateMessage(result),
			current: progress?.extracted_pages,
			total: progress?.total_pages,
		});
		await delay(DEFAULT_POLL_INTERVAL_MS);
	}

	throw new Error("MinerU 解析超时，请稍后重试。");
}

async function downloadArrayBuffer(url: string): Promise<ArrayBuffer> {
	const response = await requestUrl({
		url,
		method: "GET",
	});

	return response.arrayBuffer;
}

function buildDataId(path: string): string {
	const normalized = path
		.replace(/[^a-zA-Z0-9_.-]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 96);
	return normalized || `recallkit-${Date.now()}`;
}

function readMinerUStateMessage(result: MinerUExtractResult): string {
	if (result.state === "waiting-file") {
		return "MinerU 正在等待上传文件。";
	}

	if (result.state === "pending") {
		return "MinerU 任务正在排队。";
	}

	if (result.state === "converting") {
		return "MinerU 正在转换文件。";
	}

	if (result.state === "running") {
		const progress = result.extract_progress;
		if (progress?.extracted_pages !== undefined && progress.total_pages !== undefined) {
			return `MinerU 正在解析 PDF 页面：${progress.extracted_pages}/${progress.total_pages}。`;
		}
		return "MinerU 正在解析 PDF。";
	}

	return "MinerU 正在处理 PDF。";
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => {
		window.setTimeout(resolve, ms);
	});
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
	let timer: number | undefined;
	const timeout = new Promise<never>((_resolve, reject) => {
		timer = window.setTimeout(() => {
			reject(new Error(message));
		}, timeoutMs);
	});

	return Promise.race([promise, timeout]).finally(() => {
		if (timer !== undefined) {
			window.clearTimeout(timer);
		}
	});
}
