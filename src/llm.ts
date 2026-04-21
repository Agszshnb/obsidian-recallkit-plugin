import { requestUrl } from "obsidian";
import { RecallKitSettings } from "./settings";

export interface RecallKitCardDraft {
	title: string;
	summary: string;
	core_points: string[];
	key_arguments: string[];
	specific_actions: string[];
	tags: string[];
	card_type: "knowledge" | "inspiration" | "action";
	quality_hint: string;
}

interface AnalyzeInput {
	settings: RecallKitSettings;
	content: string;
	sourceType: "text" | "url" | "pdf";
	sourceUrl: string;
	analysisPrompt: string;
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

const MAX_INPUT_CHARS = 12000;

export async function analyzeWithOpenAICompatibleApi(input: AnalyzeInput): Promise<RecallKitCardDraft> {
	const apiKey = input.settings.apiKey.trim();
	const baseUrl = input.settings.baseUrl.trim().replace(/\/+$/, "");
	const model = input.settings.model.trim();

	if (!apiKey) {
		throw new Error("API key is not configured. Open RecallKit settings and add your model API key.");
	}

	if (!baseUrl) {
		throw new Error("API base URL is not configured.");
	}

	if (!model) {
		throw new Error("Model is not configured.");
	}

	const content = input.content.trim().slice(0, MAX_INPUT_CHARS);
	const truncatedHint = input.content.trim().length > MAX_INPUT_CHARS
		? "\n\n注意：输入内容已被插件截断，请在 quality_hint 中提示用户。"
		: "";

	const response = await requestUrl({
		url: `${baseUrl}/chat/completions`,
		method: "POST",
		headers: {
			"Authorization": `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model,
			temperature: 0.2,
			response_format: { type: "json_object" },
			messages: [
				{
					role: "system",
					content: [
						"你是 RecallKit 的知识卡片分析助手。",
						"请严格输出 JSON 对象，不要输出 Markdown，不要包裹代码块。",
						"不要编造原文没有的信息。",
						"如果信息不足，请在 quality_hint 里明确说明。",
						"输出字段固定为：title, summary, core_points, key_arguments, specific_actions, tags, card_type, quality_hint。",
						"card_type 只能是 knowledge、inspiration、action 之一。",
						"tags 使用简短中文或英文标签，不要包含 #。",
					].join("\n"),
				},
				{
					role: "user",
					content: [
						`来源类型：${input.sourceType}`,
						input.sourceUrl ? `来源 URL：${input.sourceUrl}` : "",
						input.analysisPrompt.trim()
							? `分析 Prompt：\n${input.analysisPrompt.trim()}`
							: "",
						"请把以下内容提炼为 Obsidian Markdown 知识卡片所需结构化 JSON：",
						content,
						truncatedHint,
					].filter(Boolean).join("\n\n"),
				},
			],
		}),
	});

	const data = response.json as ChatCompletionResponse;
	const providerError = data.error?.message;
	if (providerError) {
		throw new Error(providerError);
	}

	const rawContent = data.choices?.[0]?.message?.content;
	if (!rawContent) {
		throw new Error("The model response did not include message content.");
	}

	return normalizeDraft(parseJsonObject(rawContent));
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
		throw new Error("The model response was not valid JSON.");
	}
}

function normalizeDraft(value: unknown): RecallKitCardDraft {
	if (!isRecord(value)) {
		throw new Error("The model response JSON was not an object.");
	}

	const cardType = parseCardType(value.card_type);

	return {
		title: readString(value.title, "Untitled knowledge card"),
		summary: readString(value.summary, "No summary generated."),
		core_points: readStringArray(value.core_points),
		key_arguments: readStringArray(value.key_arguments),
		specific_actions: readStringArray(value.specific_actions),
		tags: readStringArray(value.tags),
		card_type: cardType,
		quality_hint: readString(value.quality_hint, "No quality hint."),
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

function parseCardType(value: unknown): RecallKitCardDraft["card_type"] {
	if (value === "inspiration" || value === "action") {
		return value;
	}

	return "knowledge";
}
