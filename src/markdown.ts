import { RecallKitCardDraft } from "./llm";

interface KnowledgeCardMarkdownInput {
	draft: RecallKitCardDraft;
	sourceType: "text" | "url" | "pdf";
	sourceValue: string;
	userNote: string;
	defaultTags: string;
}

export function buildKnowledgeCardMarkdown(input: KnowledgeCardMarkdownInput): string {
	const tags = mergeTags(input.defaultTags, input.draft.tags);
	const created = new Date().toISOString();
	const sourceUrl = input.sourceType === "url" ? input.sourceValue.trim() : "";
	const sourcePath = input.sourceType === "pdf" ? input.sourceValue.trim() : "";

	return [
		"---",
		"type: recallkit-card",
		`card_type: ${input.draft.card_type}`,
		`source_type: ${input.sourceType}`,
		`source_url: ${yamlString(sourceUrl)}`,
		`source_path: ${yamlString(sourcePath)}`,
		`created: ${created}`,
		"tags:",
		...tags.map((tag) => `  - ${tag}`),
		"---",
		"",
		`# ${input.draft.title}`,
		"",
		"## 摘要",
		"",
		input.draft.summary,
		"",
		"## 核心观点",
		"",
		renderList(input.draft.core_points),
		"",
		"## 关键论据",
		"",
		renderList(input.draft.key_arguments),
		"",
		"## 具体做法",
		"",
		renderList(input.draft.specific_actions),
		"",
		"## 质量提示",
		"",
		input.draft.quality_hint,
		"",
		"## 我的备注",
		"",
		input.userNote.trim() || "No note.",
		"",
		"## 来源",
		"",
		input.sourceValue.trim(),
		"",
	].join("\n");
}

function mergeTags(defaultTags: string, draftTags: string[]): string[] {
	const tags = [
		...parseTags(defaultTags),
		...draftTags.map((tag) => tag.trim().replace(/^#/, "")),
	]
		.filter((tag) => tag.length > 0)
		.map((tag) => tag.replace(/\s+/g, "-"));

	return [...new Set(tags)].slice(0, 12);
}

function parseTags(value: string): string[] {
	return value
		.split(",")
		.map((tag) => tag.trim().replace(/^#/, ""))
		.filter((tag) => tag.length > 0);
}

function renderList(items: string[]): string {
	if (items.length === 0) {
		return "- 未生成";
	}

	return items.map((item) => `- ${item}`).join("\n");
}

function yamlString(value: string): string {
	return JSON.stringify(value);
}
