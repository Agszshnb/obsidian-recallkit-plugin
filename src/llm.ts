import { requestUrl } from "obsidian";
import { RecallKitSettings } from "./settings";

export interface RecallKitCardDraft {
	title: string;
	sections: RecallKitCardSection[];
	tags: string[];
	card_type: "knowledge" | "inspiration" | "action";
	quality_hint: string;
}

export interface RecallKitCardSection {
	title: string;
	content?: string;
	items?: string[];
}

interface AnalyzeInput {
	settings: RecallKitSettings;
	content: string;
	sourceType: "text" | "url" | "pdf";
	sourceUrl: string;
	analysisPrompt: string;
	allowChunking?: boolean;
	onProgress?: (progress: AnalysisProgress) => void;
}

interface ChatCompletionResponse {
	choices?: Array<{
		message?: {
			content?: string;
		};
	}>;
	error?: {
		message?: string;
	};
}

export interface AnalysisProgress {
	stage: "preparing" | "single-pass" | "chunking" | "chunk" | "synthesizing" | "done";
	message: string;
	current?: number;
	total?: number;
}

const DEFAULT_SINGLE_PASS_CHARS = 200000;
const MAX_TOTAL_INPUT_CHARS = 500000;
const CHUNK_CHARS = 20000;
const CHUNK_ANALYSIS_CONCURRENCY = 2;

export async function analyzeWithOpenAICompatibleApi(input: AnalyzeInput): Promise<RecallKitCardDraft> {
	const apiKey = input.settings.apiKey.trim();
	const baseUrl = input.settings.baseUrl.trim().replace(/\/+$/, "");
	const model = input.settings.model.trim();

	if (!apiKey) {
		throw new Error("å°šæœªé…ç½® API Keyã€‚è¯·å…ˆæ‰“å¼€ RecallKit è®¾ç½®å¹¶å¡«å†™æ¨¡åž‹ API Keyã€‚");
	}

	if (!baseUrl) {
		throw new Error("å°šæœªé…ç½® API base URLã€‚");
	}

	if (!model) {
		throw new Error("å°šæœªé…ç½®æ¨¡åž‹ã€‚");
	}

	const trimmedContent = input.content.trim();
	const singlePassLimit = Math.max(input.settings.singlePassCharLimit || DEFAULT_SINGLE_PASS_CHARS, 10000);
	if (trimmedContent.length <= singlePassLimit) {
		input.onProgress?.({
			stage: "single-pass",
			message: "内容较短，正在一次性调用模型生成知识卡片。",
			current: 1,
			total: 1,
		});
		return analyzeSinglePass({
			apiKey,
			baseUrl,
			model,
			input,
			content: trimmedContent,
			truncated: false,
		});
	}

	if (!input.allowChunking) {
		throw new Error(`内容长度 ${trimmedContent.length} 字符，超过单次分析上限 ${singlePassLimit} 字符。`);
	}

	input.onProgress?.({
		stage: "chunking",
		message: "内容较长，正在切分为多个片段进行分析。",
	});
	return analyzeChunked({
		apiKey,
		baseUrl,
		model,
		input,
		content: trimmedContent,
	});
}

async function analyzeSinglePass(options: {
	apiKey: string;
	baseUrl: string;
	model: string;
	input: AnalyzeInput;
	content: string;
	truncated: boolean;
}): Promise<RecallKitCardDraft> {
	const truncatedHint = options.truncated
		? "\n\n注意：输入内容超过插件当前安全上限，已被截断。请在 quality_hint 中提示用户。"
		: "";
	const rawContent = await requestChatCompletion(options.apiKey, options.baseUrl, {
		model: options.model,
		temperature: 0.2,
		response_format: { type: "json_object" },
		messages: [
			{
				role: "system",
				content: buildCardSystemPrompt(),
			},
			{
				role: "user",
				content: [
					`来源类型：${options.input.sourceType}`,
					options.input.sourceUrl ? `来源 URL：${options.input.sourceUrl}` : "",
					options.input.analysisPrompt.trim()
						? `分析 Prompt：\n${options.input.analysisPrompt.trim()}`
						: "",
					"结构要求：最终 JSON 只能使用 sections 表达卡片正文。即使分析 Prompt 中提到 summary、core_points、key_arguments、specific_actions，也不要输出这些旧字段。",
					"请把以下内容提炼为 Obsidian Markdown 知识卡片所需结构化 JSON：",
					options.content,
					truncatedHint,
				].filter(Boolean).join("\n\n"),
			},
		],
	});

	return normalizeDraft(parseJsonObject(rawContent));
}

async function analyzeChunked(options: {
	apiKey: string;
	baseUrl: string;
	model: string;
	input: AnalyzeInput;
	content: string;
}): Promise<RecallKitCardDraft> {
	const truncated = options.content.length > MAX_TOTAL_INPUT_CHARS;
	const boundedContent = truncated
		? options.content.slice(0, MAX_TOTAL_INPUT_CHARS)
		: options.content;
	const chunks = splitTextIntoChunks(boundedContent, CHUNK_CHARS);
	const chunkAnalyses: unknown[] = new Array(chunks.length);
	let completedChunks = 0;

	options.input.onProgress?.({
		stage: "chunking",
		message: `已切分为 ${chunks.length} 个片段，准备并发分析。`,
		current: 0,
		total: chunks.length + 1,
	});

	await runWithConcurrency(chunks, CHUNK_ANALYSIS_CONCURRENCY, async (chunk, index) => {
		options.input.onProgress?.({
			stage: "chunk",
			message: `正在分析分段，已完成 ${completedChunks} / ${chunks.length} 个。`,
			current: completedChunks,
			total: chunks.length + 1,
		});
		const rawContent = await analyzeChunk(options, chunk, index, chunks.length);
		chunkAnalyses[index] = parsePartialJson(rawContent);
		completedChunks += 1;
		options.input.onProgress?.({
			stage: "chunk",
			message: `正在分析分段，已完成 ${completedChunks} / ${chunks.length} 个。`,
			current: completedChunks,
			total: chunks.length + 1,
		});
	});

	options.input.onProgress?.({
		stage: "synthesizing",
		message: "分段分析完成，正在综合生成最终知识卡片。",
		current: chunks.length + 1,
		total: chunks.length + 1,
	});
	const rawFinal = await requestChatCompletion(options.apiKey, options.baseUrl, {
		model: options.model,
		temperature: 0.2,
		response_format: { type: "json_object" },
		messages: [
			{
				role: "system",
				content: buildCardSystemPrompt(),
			},
			{
				role: "user",
				content: [
					`来源类型：${options.input.sourceType}`,
					options.input.sourceUrl ? `来源 URL：${options.input.sourceUrl}` : "",
					options.input.analysisPrompt.trim()
						? `分析 Prompt：\n${options.input.analysisPrompt.trim()}`
						: "",
					"结构要求：最终 JSON 只能使用 sections 表达卡片正文。即使分析 Prompt 中提到 summary、core_points、key_arguments、specific_actions，也不要输出这些旧字段。",
					"下面是同一份长文档的分段分析结果。请综合所有分段，生成最终 Obsidian Markdown 知识卡片所需结构化 JSON。",
					"不要把单个分段里的局部信息误写成全文结论。需要合并重复观点，并在 quality_hint 中说明这是分段综合分析。",
					truncated ? "注意：原始输入超过插件当前安全上限，已在分段前截断。请在 quality_hint 中明确说明。" : "",
					JSON.stringify(chunkAnalyses),
				].filter(Boolean).join("\n\n"),
			},
		],
	});

	const draft = normalizeDraft(parseJsonObject(rawFinal));
	options.input.onProgress?.({
		stage: "done",
		message: "分析完成，正在生成预览。",
		current: chunks.length + 1,
		total: chunks.length + 1,
	});
	return draft;
}

async function analyzeChunk(
	options: {
		apiKey: string;
		baseUrl: string;
		model: string;
		input: AnalyzeInput;
		content: string;
	},
	chunk: string,
	index: number,
	total: number,
): Promise<string> {
	return requestChatCompletion(options.apiKey, options.baseUrl, {
		model: options.model,
		temperature: 0.2,
		response_format: { type: "json_object" },
		messages: [
			{
				role: "system",
				content: [
					"你是 RecallKit 的文献分段分析助手。",
					"请严格输出 JSON 对象，不要输出 Markdown，不要包裹代码块。",
					"只依据当前分段内容，不要编造当前分段没有的信息。",
					"输出字段建议包含：section_summary, research_question, contributions, methods, evidence, limitations, reusable_points, open_questions。",
				].join("\n"),
			},
			{
				role: "user",
				content: [
					`来源类型：${options.input.sourceType}`,
					options.input.sourceUrl ? `来源 URL：${options.input.sourceUrl}` : "",
					`当前分段：${index + 1}/${total}`,
					options.input.analysisPrompt.trim()
						? `整体分析 Prompt：\n${options.input.analysisPrompt.trim()}`
						: "",
					"请分析下面这段内容，保留研究问题、贡献、方法、证据、局限、可复用观点和待核查问题：",
					chunk,
				].filter(Boolean).join("\n\n"),
			},
		],
	});
}

async function requestChatCompletion(apiKey: string, baseUrl: string, body: object): Promise<string> {
	const response = await requestUrl({
		url: `${baseUrl}/chat/completions`,
		method: "POST",
		headers: {
			"Authorization": `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
	});

	const data = response.json as ChatCompletionResponse;
	const providerError = data.error?.message;
	if (providerError) {
		throw new Error(providerError);
	}

	const rawContent = data.choices?.[0]?.message?.content;
	if (!rawContent) {
		throw new Error("æ¨¡åž‹å“åº”ä¸­æ²¡æœ‰è¿”å›ž message contentã€‚");
	}

	return rawContent;
}

async function runWithConcurrency<T>(
	items: T[],
	concurrency: number,
	worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
	let nextIndex = 0;
	const workers = new Array(Math.min(concurrency, items.length))
		.fill(null)
		.map(async () => {
			while (nextIndex < items.length) {
				const index = nextIndex;
				nextIndex += 1;
				const item = items[index];
				if (item === undefined) {
					continue;
				}
				await worker(item, index);
			}
		});

	await Promise.all(workers);
}

function buildCardSystemPrompt(): string {
	return [
		"你是 RecallKit 的知识卡片分析助手。",
		"请严格输出 JSON 对象，不要输出 Markdown，不要包裹代码块。",
		"不要编造原文没有的信息。",
		"如果信息不足，请在 quality_hint 里明确说明。",
		"输出字段固定为：title, sections, tags, card_type, quality_hint。",
		"sections 是数组，每个元素包含 title、content、items。content 适合段落，items 适合列表；二者至少提供一个。",
		"请根据内容类型自拟 3-6 个 section 标题，不要机械套用“摘要、核心观点、关键论据、具体做法”。",
		"示例 section 标题可以是：研究问题、方法路径、证据强度、可复用洞察、待核查问题、事件脉络、作者立场、应用边界。",
		"section 标题必须贴合原文，不要为了变化而制造空泛栏目。",
		"card_type 只能是 knowledge、inspiration、action 之一。",
		"tags 使用简短中文或英文标签，不要包含 #。",
	].join("\n");
}

function splitTextIntoChunks(text: string, maxChars: number): string[] {
	const paragraphs = text.split(/\n{2,}/);
	const chunks: string[] = [];
	let current = "";

	for (const paragraph of paragraphs) {
		const normalized = paragraph.trim();
		if (!normalized) {
			continue;
		}

		if (normalized.length > maxChars) {
			if (current) {
				chunks.push(current);
				current = "";
			}
			for (let index = 0; index < normalized.length; index += maxChars) {
				chunks.push(normalized.slice(index, index + maxChars));
			}
			continue;
		}

		const next = current ? `${current}\n\n${normalized}` : normalized;
		if (next.length > maxChars && current) {
			chunks.push(current);
			current = normalized;
		} else {
			current = next;
		}
	}

	if (current) {
		chunks.push(current);
	}

	return chunks;
}

function parsePartialJson(rawContent: string): unknown {
	try {
		return parseJsonObject(rawContent);
	} catch (_error) {
		return { section_summary: rawContent.trim() };
	}
}

function parseJsonObject(rawContent: string): unknown {
	const cleaned = rawContent
		.trim()
		.replace(/^```json\s*/i, "")
		.replace(/^```\s*/i, "")
		.replace(/\s*```$/i, "");

	try {
		return JSON.parse(cleaned);
	} catch (_error) {
		const start = cleaned.indexOf("{");
		const end = cleaned.lastIndexOf("}");
		if (start >= 0 && end > start) {
			return JSON.parse(cleaned.slice(start, end + 1));
		}
		throw new Error("æ¨¡åž‹å“åº”ä¸æ˜¯åˆæ³• JSONã€‚");
	}
}

function normalizeDraft(value: unknown): RecallKitCardDraft {
	if (!isRecord(value)) {
		throw new Error("æ¨¡åž‹å“åº” JSON ä¸æ˜¯å¯¹è±¡ã€‚");
	}

	const cardType = parseCardType(value.card_type);

	return {
		title: readString(value.title, "æœªå‘½åçŸ¥è¯†å¡ç‰‡"),
		sections: readSections(value),
		tags: readStringArray(value.tags),
		card_type: cardType,
		quality_hint: readString(value.quality_hint, "æ— è´¨é‡æç¤ºã€‚"),
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown, fallback: string): string {
	return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value
		.filter((item): item is string => typeof item === "string")
		.map((item) => item.trim())
		.filter((item) => item.length > 0);
}

function readSections(value: Record<string, unknown>): RecallKitCardSection[] {
	const sections = readSectionArray(value.sections);
	if (sections.length > 0) {
		return sections;
	}

	return legacyFieldsToSections(value);
}

function readSectionArray(value: unknown): RecallKitCardSection[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value
		.map((item) => {
			if (!isRecord(item)) {
				return null;
			}

			const title = readString(item.title, "");
			const content = readString(item.content, "");
			const items = readStringArray(item.items);
			if (!title || (!content && items.length === 0)) {
				return null;
			}

			return {
				title,
				...(content ? { content } : {}),
				...(items.length > 0 ? { items } : {}),
			};
		})
		.filter((item): item is RecallKitCardSection => item !== null);
}

function legacyFieldsToSections(value: Record<string, unknown>): RecallKitCardSection[] {
	const sections: RecallKitCardSection[] = [];
	const summary = readString(value.summary, "");
	const corePoints = readStringArray(value.core_points);
	const keyArguments = readStringArray(value.key_arguments);
	const specificActions = readStringArray(value.specific_actions);

	if (summary) {
		sections.push({ title: "摘要", content: summary });
	}
	if (corePoints.length > 0) {
		sections.push({ title: "核心观点", items: corePoints });
	}
	if (keyArguments.length > 0) {
		sections.push({ title: "关键论据", items: keyArguments });
	}
	if (specificActions.length > 0) {
		sections.push({ title: "具体做法", items: specificActions });
	}

	if (sections.length === 0) {
		sections.push({ title: "内容概览", content: "No summary generated." });
	}

	return sections;
}

function parseCardType(value: unknown): RecallKitCardDraft["card_type"] {
	if (value === "inspiration" || value === "action") {
		return value;
	}

	return "knowledge";
}
