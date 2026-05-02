import { requestUrl } from "obsidian";

export interface FetchResult {
	title: string;
	content: string;
	url: string;
	truncated: boolean;
	extractionMethod: "direct" | "jina-reader";
}

type ExtractedUrlContent = Omit<FetchResult, "truncated" | "extractionMethod">;

const MAX_URL_TEXT_CHARS = 30000;
const MIN_USEFUL_TEXT_CHARS = 120;
const BROWSER_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

export async function fetchUrlContent(rawUrl: string): Promise<FetchResult> {
	const url = normalizeHttpUrl(rawUrl);
	let directError: Error | null = null;

	try {
		const direct = await fetchDirectUrlContent(url);
		assertUsefulExtractedContent(direct, "Direct URL extraction");
		return finalizeFetchResult(direct, "direct");
	} catch (error) {
		directError = normalizeError(error);
	}

	try {
		const jina = await fetchJinaReaderContent(url);
		assertUsefulExtractedContent(jina, "Jina Reader fallback");
		return finalizeFetchResult(jina, "jina-reader");
	} catch (error) {
		const fallbackError = normalizeError(error);
		throw new Error(
			[
				"URL æå–å¤±è´¥ã€‚",
				`ç›´æŽ¥æŠ“å–ï¼š${directError.message}`,
				`Jina Reader å›žé€€ï¼š${fallbackError.message}`,
				"å¯ä»¥æ”¹ç”¨æ–‡æœ¬æ¨¡å¼ç²˜è´´ç½‘é¡µæ­£æ–‡ï¼Œæˆ–ä½¿ç”¨å·²ç™»å½•/å¤–éƒ¨çš„æå–å·¥å…·ã€‚",
			].join(" "),
		);
	}
}

async function fetchDirectUrlContent(url: string): Promise<ExtractedUrlContent> {
	const response = await requestUrl({
		url,
		method: "GET",
		throw: false,
		headers: {
			"Accept": "text/html,application/xhtml+xml,text/plain,application/json;q=0.9,*/*;q=0.8",
			"Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
			"User-Agent": BROWSER_USER_AGENT,
		},
	});

	if (response.status >= 400) {
		throw new Error(`URL è¯·æ±‚å¤±è´¥ï¼ŒHTTP çŠ¶æ€ç ï¼š${response.status}ã€‚`);
	}

	const contentType = readHeader(response.headers, "content-type");
	const htmlResponse = isHtmlResponse(contentType, response.text);
	if (!htmlResponse && contentType && !isReadableTextResponse(contentType)) {
		throw new Error(`URL æ²¡æœ‰è¿”å›žå¯è¯»æ–‡æœ¬æˆ– HTMLï¼ˆ${contentType}ï¼‰ã€‚`);
	}

	const extraction = htmlResponse
		? extractFromHtml(response.text, url)
		: extractFromPlainText(response.text, url);

	if (!extraction.content.trim()) {
		throw new Error("æ²¡æœ‰ä»Žè¯¥ URL æå–åˆ°å¯è¯»æ–‡æœ¬ã€‚");
	}

	return {
		title: extraction.title,
		content: extraction.content,
		url,
	};
}

async function fetchJinaReaderContent(url: string): Promise<ExtractedUrlContent> {
	const response = await requestUrl({
		url: buildJinaReaderUrl(url),
		method: "GET",
		throw: false,
		headers: {
			"Accept": "text/plain, text/markdown, */*;q=0.8",
			"User-Agent": BROWSER_USER_AGENT,
		},
	});

	if (response.status >= 400) {
		throw new Error(`Jina Reader è¯·æ±‚å¤±è´¥ï¼ŒHTTP çŠ¶æ€ç ï¼š${response.status}ã€‚`);
	}

	const warning = readJinaWarning(response.text);
	if (warning) {
		throw new Error(warning);
	}

	const parsed = extractFromJinaMarkdown(response.text, url);
	return parsed;
}

function finalizeFetchResult(
	result: ExtractedUrlContent,
	extractionMethod: FetchResult["extractionMethod"],
): FetchResult {
	const truncated = result.content.length > MAX_URL_TEXT_CHARS;

	return {
		title: result.title,
		content: result.content.slice(0, MAX_URL_TEXT_CHARS),
		url: result.url,
		truncated,
		extractionMethod,
	};
}

function buildJinaReaderUrl(url: string): string {
	return `https://r.jina.ai/${url}`;
}

function assertUsefulExtractedContent(result: ExtractedUrlContent, source: string): void {
	const content = result.content.trim();
	if (content.length < MIN_USEFUL_TEXT_CHARS) {
		throw new Error(`${source} è¿”å›žçš„å¯è¯»æ–‡æœ¬è¿‡å°‘ã€‚`);
	}

	if (isKnownBlockedOrShellContent(result.url, result.title, content)) {
		throw new Error(`${source} è¿”å›žçš„æ˜¯ç™»å½•ã€åçˆ¬æˆ–é¡µé¢å£³ï¼Œä¸æ˜¯æ–‡ç« æ­£æ–‡ã€‚`);
	}
}

function readJinaWarning(markdown: string): string {
	const warning = markdown.match(/^Warning:\s*(.+)$/im)?.[1]?.trim();
	if (!warning) {
		return "";
	}

	return `Jina Reader è­¦å‘Šï¼š${warning}`;
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

function readHeader(headers: Record<string, string>, name: string): string {
	const wanted = name.toLowerCase();
	for (const key in headers) {
		if (key.toLowerCase() === wanted) {
			return headers[key]?.toLowerCase() ?? "";
		}
	}

	return "";
}

function isHtmlResponse(contentType: string, text: string): boolean {
	const trimmed = text.trimStart().slice(0, 100).toLowerCase();
	return contentType.includes("html") || trimmed.startsWith("<!doctype html") || trimmed.startsWith("<html");
}

function isReadableTextResponse(contentType: string): boolean {
	return contentType.startsWith("text/")
		|| contentType.includes("json")
		|| contentType.includes("xml")
		|| contentType.includes("markdown");
}

function isKnownBlockedOrShellContent(url: string, title: string, content: string): boolean {
	const host = new URL(url).hostname.toLowerCase();
	const normalizedTitle = normalizeWhitespace(title).toLowerCase();
	const normalizedContent = normalizeWhitespace(content).toLowerCase();

	if (host.endsWith("zhihu.com") || host.endsWith("zhihu.com.cn")) {
		return includesAny(normalizedContent, [
			"知乎，让每一次点击都充满意义",
			"欢迎来到知乎，发现问题背后的世界",
			"you've reached a knowledge desert",
			"auto-redirecting in 5 seconds",
			"登录/注册",
			"请完成安全验证",
			"安全验证",
			"该页面不存在",
		]) || normalizedTitle === "zhihu" || normalizedTitle === "知乎";
	}

	return includesAny(normalizedContent, [
		"please enable javascript",
		"enable javascript and cookies",
		"access denied",
		"403 forbidden",
		"checking your browser",
		"verify you are human",
		"please complete the security check",
	]);
}

function includesAny(value: string, patterns: string[]): boolean {
	return patterns.some((pattern) => value.includes(pattern));
}

function extractFromHtml(html: string, url: string): ExtractedUrlContent {
	const parser = new DOMParser();
	const document = parser.parseFromString(html, "text/html");

	for (const element of Array.from(document.querySelectorAll("script, style, noscript, svg, canvas, iframe, form, nav, footer, aside"))) {
		element.remove();
	}

	const title = normalizeWhitespace(
		readMeta(document, "og:title")
		|| readMeta(document, "twitter:title")
		|| document.querySelector("title")?.textContent
		|| new URL(url).hostname,
	);

	const candidate = document.querySelector("article")
		|| document.querySelector("main")
		|| document.querySelector("[role='main']")
		|| document.body;
	const content = extractReadableText(candidate);

	if (content.length >= MIN_USEFUL_TEXT_CHARS) {
		return { title, content, url };
	}

	return {
		title,
		content: cleanText(document.body?.textContent ?? ""),
		url,
	};
}

function extractFromPlainText(text: string, url: string): ExtractedUrlContent {
	return {
		title: new URL(url).hostname,
		content: cleanText(text),
		url,
	};
}

function extractFromJinaMarkdown(markdown: string, url: string): ExtractedUrlContent {
	const lines = markdown.replace(/\r\n/g, "\n").split("\n");
	let title = "";
	let sourceUrl = url;
	let contentStart = 0;

	for (let index = 0; index < Math.min(lines.length, 20); index += 1) {
		const line = lines[index]?.trim() ?? "";
		const titleMatch = line.match(/^Title:\s*(.+)$/i);
		if (titleMatch?.[1]) {
			title = titleMatch[1].trim();
			contentStart = Math.max(contentStart, index + 1);
			continue;
		}

		const sourceMatch = line.match(/^URL Source:\s*(.+)$/i);
		if (sourceMatch?.[1]) {
			sourceUrl = normalizeHttpUrl(sourceMatch[1]);
			contentStart = Math.max(contentStart, index + 1);
			continue;
		}

		if (/^Markdown Content:\s*$/i.test(line)) {
			contentStart = index + 1;
			break;
		}
	}

	const content = cleanMarkdownText(lines.slice(contentStart).join("\n"));
	return {
		title: title || readMarkdownTitle(content) || new URL(url).hostname,
		content,
		url: sourceUrl,
	};
}

function readMeta(document: Document, property: string): string {
	return document.querySelector(`meta[property="${property}"]`)?.getAttribute("content")
		|| document.querySelector(`meta[name="${property}"]`)?.getAttribute("content")
		|| "";
}

function extractReadableText(root: Element | null): string {
	if (!root) {
		return "";
	}

	const blocks = Array.from(root.querySelectorAll("h1, h2, h3, h4, h5, h6, p, li, blockquote, pre, td, th"))
		.map((element) => normalizeWhitespace(element.textContent ?? ""))
		.filter((value) => value.length > 0);

	if (blocks.length === 0) {
		return cleanText(root.textContent ?? "");
	}

	return dedupeAdjacent(blocks).join("\n\n").trim();
}

function dedupeAdjacent(values: string[]): string[] {
	const deduped: string[] = [];

	for (const value of values) {
		if (deduped[deduped.length - 1] !== value) {
			deduped.push(value);
		}
	}

	return deduped;
}

function cleanText(value: string): string {
	return value
		.split(/\n{2,}/)
		.map(normalizeWhitespace)
		.filter((line) => line.length > 0)
		.join("\n\n")
		.trim();
}

function cleanMarkdownText(value: string): string {
	return value
		.replace(/\r\n/g, "\n")
		.replace(/\n{3,}/g, "\n\n")
		.split("\n")
		.map((line) => line.replace(/[ \t]+$/g, ""))
		.join("\n")
		.trim();
}

function readMarkdownTitle(value: string): string {
	const match = value.match(/^#\s+(.+)$/m);
	return match?.[1]?.trim() ?? "";
}

function normalizeWhitespace(value: string): string {
	return value.replace(/\s+/g, " ").trim();
}

function normalizeError(error: unknown): Error {
	return error instanceof Error ? error : new Error(String(error));
}
