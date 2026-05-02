import { App, requestUrl, TFile } from "obsidian";
import { RecallKitSettings } from "./settings";
import { readFilesFromZip, readTextFileFromZip } from "./zip";

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
	assets: MinerUAsset[];
}

export interface MinerUAsset {
	path: string;
	data: Uint8Array;
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

interface MinerUTaskData {
	task_id?: string;
}

interface MinerUBatchResultData {
	batch_id?: string;
	extract_result?: MinerUExtractResult[];
}

interface MinerUTaskResultData extends MinerUExtractResult {
	task_id?: string;
	data_id?: string;
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
		throw new Error("å°šæœªé…ç½® MinerU API Tokenã€‚è¯·å…ˆåœ¨ RecallKit è®¾ç½®ä¸­å¡«å†™ Tokenã€‚");
	}

	const file = options.app.vault.getFileByPath(options.path);
	if (!(file instanceof TFile) || file.extension.toLowerCase() !== "pdf") {
		throw new Error("è¯·ä»Žå½“å‰ vault ä¸­é€‰æ‹©ä¸€ä¸ª PDF æ–‡ä»¶ã€‚");
	}

	options.onProgress?.({
		stage: "preparing",
		message: "æ­£åœ¨å‘ MinerU è¯·æ±‚ä¸Šä¼ åœ°å€ã€‚",
	});
	const uploadData = await requestMinerUUploadUrl({
		token,
		file,
		settings: options.settings,
	});
	const uploadUrl = uploadData.file_urls?.[0];
	const batchId = uploadData.batch_id;
	if (!uploadUrl || !batchId) {
		throw new Error("MinerU æ²¡æœ‰è¿”å›žå¯ç”¨çš„ä¸Šä¼ åœ°å€ã€‚");
	}

	options.onProgress?.({
		stage: "preparing",
		message: "æ­£åœ¨ä¸Šä¼  PDF åˆ° MinerUã€‚",
	});
	const pdfBuffer = await options.app.vault.readBinary(file);
	await uploadFileToMinerU(uploadUrl, pdfBuffer);

	options.onProgress?.({
		stage: "preparing",
		message: "æ­£åœ¨ç­‰å¾… MinerU è§£æž PDFã€‚",
	});
	const result = await pollMinerUBatchResult({
		token,
		batchId,
		timeoutMs: Math.max(options.settings.mineruPollTimeoutSeconds, 30) * 1000,
		onProgress: options.onProgress,
	});

	const parsed = await downloadMinerUResult({
		url: result.full_zip_url,
		emptyMessage: "MinerU å·²å®Œæˆè§£æžï¼Œä½†æ²¡æœ‰è¿”å›žç»“æžœåŽ‹ç¼©åŒ…åœ°å€ã€‚",
		onProgress: options.onProgress,
	});

	return {
		path: file.path,
		text: parsed.markdown,
		parseMethod: "mineru-cloud",
		taskState: result.state ?? "done",
		assets: parsed.assets,
	};
}
export async function parseUrlWithMinerUCloud(options: {
	url: string;
	settings: RecallKitSettings;
	onProgress?: (progress: MinerUProgress) => void;
}): Promise<MinerUParseResult> {
	const token = options.settings.mineruApiToken.trim();
	if (!token) {
		throw new Error("å°šæœªé…ç½® MinerU API Tokenã€‚è¯·å…ˆåœ¨ RecallKit è®¾ç½®ä¸­å¡«å†™ Tokenã€‚");
	}

	const url = normalizeHttpUrl(options.url);
	options.onProgress?.({
		stage: "preparing",
		message: "æ­£åœ¨æŠŠ URL æäº¤ç»™ MinerU ç½‘é¡µè§£æžã€‚",
	});
	const taskData = await requestMinerUUrlTask({
		token,
		url,
	});
	if (!taskData.task_id) {
		throw new Error("MinerU æ²¡æœ‰è¿”å›žå¯ç”¨çš„ URL è§£æžä»»åŠ¡ IDã€‚");
	}

	options.onProgress?.({
		stage: "preparing",
		message: "æ­£åœ¨ç­‰å¾… MinerU è§£æžç½‘é¡µã€‚",
	});
	const result = await pollMinerUTaskResult({
		token,
		taskId: taskData.task_id,
		timeoutMs: Math.max(options.settings.mineruPollTimeoutSeconds, 30) * 1000,
		onProgress: options.onProgress,
	});

	const parsed = await downloadMinerUResult({
		url: result.full_zip_url,
		emptyMessage: "MinerU å·²å®Œæˆç½‘é¡µè§£æžï¼Œä½†æ²¡æœ‰è¿”å›žç»“æžœåŽ‹ç¼©åŒ…åœ°å€ã€‚",
		onProgress: options.onProgress,
	});

	return {
		path: url,
		text: parsed.markdown,
		parseMethod: "mineru-cloud",
		taskState: result.state ?? "done",
		assets: parsed.assets,
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

async function requestMinerUUrlTask(options: {
	token: string;
	url: string;
}): Promise<MinerUTaskData> {
	const response = await requestUrl({
		url: `${MINERU_API_BASE_URL}/api/v4/extract/task`,
		method: "POST",
		headers: {
			"Authorization": `Bearer ${options.token}`,
			"Content-Type": "application/json",
			"Accept": "*/*",
		},
		body: JSON.stringify({
			url: options.url,
			data_id: buildDataId(options.url),
			model_version: "MinerU-HTML",
		}),
	});

	const data = response.json as MinerUApiResponse<MinerUTaskData>;
	if (data.code !== 0 || !data.data) {
		throw new Error(data.msg || "è¯·æ±‚ MinerU URL è§£æžä»»åŠ¡å¤±è´¥ã€‚");
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

async function pollMinerUTaskResult(options: {
	token: string;
	taskId: string;
	timeoutMs: number;
	onProgress?: (progress: MinerUProgress) => void;
}): Promise<MinerUTaskResultData> {
	const startedAt = Date.now();

	while (Date.now() - startedAt < options.timeoutMs) {
		const response = await requestUrl({
			url: `${MINERU_API_BASE_URL}/api/v4/extract/task/${options.taskId}`,
			method: "GET",
			headers: {
				"Authorization": `Bearer ${options.token}`,
				"Accept": "*/*",
			},
		});
		const payload = response.json as MinerUApiResponse<MinerUTaskResultData>;
		if (payload.code !== 0 || !payload.data) {
			throw new Error(payload.msg || "æŸ¥è¯¢ MinerU URL è§£æžä»»åŠ¡ç»“æžœå¤±è´¥ã€‚");
		}

		const result = payload.data;
		if (result.state === "done") {
			return result;
		}

		if (result.state === "failed") {
			throw new Error(result.err_msg || "MinerU URL è§£æžå¤±è´¥ã€‚");
		}

		options.onProgress?.({
			stage: "preparing",
			message: readMinerUStateMessage(result, "ç½‘é¡µ"),
			current: result.extract_progress?.extracted_pages,
			total: result.extract_progress?.total_pages,
		});
		await delay(DEFAULT_POLL_INTERVAL_MS);
	}

	throw new Error("MinerU URL è§£æžè¶…æ—¶ï¼Œè¯·ç¨åŽé‡è¯•ã€‚");
}

async function downloadMinerUResult(options: {
	url?: string;
	emptyMessage: string;
	onProgress?: (progress: MinerUProgress) => void;
}): Promise<{ markdown: string; assets: MinerUAsset[] }> {
	if (!options.url) {
		throw new Error(options.emptyMessage);
	}

	options.onProgress?.({
		stage: "preparing",
		message: "æ­£åœ¨ä¸‹è½½ MinerU è§£æžç»“æžœåŽ‹ç¼©åŒ…ã€‚",
	});
	const zipData = await withTimeout(
		downloadArrayBuffer(options.url),
		RESULT_DOWNLOAD_TIMEOUT_MS,
		"ä¸‹è½½ MinerU è§£æžç»“æžœåŽ‹ç¼©åŒ…è¶…æ—¶ã€‚å¯èƒ½æ˜¯ MinerU CDN è®¿é—®è¾ƒæ…¢æˆ–å½“å‰ç½‘ç»œå—é˜»ï¼Œè¯·ç¨åŽé‡è¯•ã€‚",
	);

	options.onProgress?.({
		stage: "preparing",
		message: "æ­£åœ¨ä»Ž MinerU ç»“æžœåŽ‹ç¼©åŒ…ä¸­æå– full.md å’Œå›¾ç‰‡èµ„æºã€‚",
	});
	const markdown = await withTimeout(
		readTextFileFromZip(zipData, "full.md"),
		RESULT_EXTRACT_TIMEOUT_MS,
		"ä»Ž MinerU ç»“æžœåŽ‹ç¼©åŒ…ä¸­æå– full.md è¶…æ—¶ã€‚",
	);
	const trimmed = markdown.trim();
	if (!trimmed) {
		throw new Error("MinerU è¿”å›žçš„ Markdown ç»“æžœä¸ºç©ºã€‚");
	}

	const assets = await withTimeout(
		readFilesFromZip(zipData, isMinerUAssetPath),
		RESULT_EXTRACT_TIMEOUT_MS,
		"ä»Ž MinerU ç»“æžœåŽ‹ç¼©åŒ…ä¸­æå–å›¾ç‰‡èµ„æºè¶…æ—¶ã€‚",
	);

	return {
		markdown: trimmed,
		assets: assets.map((asset) => ({
			path: asset.name,
			data: asset.data,
		})),
	};
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

function isMinerUAssetPath(path: string): boolean {
	const normalized = path.replace(/\\/g, "/").toLowerCase();
	return /^images\/[^/].+\.(png|jpe?g|webp|gif|bmp|svg)$/.test(normalized);
}

function readMinerUStateMessage(result: MinerUExtractResult, sourceName = "PDF"): string {
	if (result.state === "waiting-file") {
		return "MinerU æ­£åœ¨ç­‰å¾…ä¸Šä¼ æ–‡ä»¶ã€‚";
	}

	if (result.state === "pending") {
		return "MinerU ä»»åŠ¡æ­£åœ¨æŽ’é˜Ÿã€‚";
	}

	if (result.state === "converting") {
		return "MinerU æ­£åœ¨è½¬æ¢æ–‡ä»¶ã€‚";
	}

	if (result.state === "running") {
		const progress = result.extract_progress;
		if (progress?.extracted_pages !== undefined && progress.total_pages !== undefined) {
			return `MinerU æ­£åœ¨è§£æž ${sourceName}ï¼š${progress.extracted_pages}/${progress.total_pages}ã€‚`;
		}
		return `MinerU æ­£åœ¨è§£æž ${sourceName}ã€‚`;
	}

	return `MinerU æ­£åœ¨å¤„ç† ${sourceName}ã€‚`;
}

function normalizeHttpUrl(value: string): string {
	const trimmed = value.trim();
	if (!trimmed) {
		throw new Error("è¯·è¾“å…¥ URLã€‚");
	}

	const candidate = /^[a-z][a-z\d+\-.]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
	let parsed: URL;

	try {
		parsed = new URL(candidate);
	} catch (_error) {
		throw new Error("è¯·è¾“å…¥æœ‰æ•ˆçš„ URLã€‚");
	}

	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		throw new Error("ä»…æ”¯æŒ http å’Œ https URLã€‚");
	}

	return parsed.toString();
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
