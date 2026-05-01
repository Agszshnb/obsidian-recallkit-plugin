import { App, normalizePath, TFile } from "obsidian";

export type BuiltInAnalysisPromptId = "general" | "news" | "literature-review" | "social-media";
export type AnalysisPromptMode = "built-in" | "vault-md" | "manual" | "default";

interface BuiltInAnalysisPrompt {
	id: BuiltInAnalysisPromptId;
	label: string;
	description: string;
	fallback: string;
	bundledPath?: string;
}

export const DEFAULT_BUILT_IN_PROMPT_ID: BuiltInAnalysisPromptId = "literature-review";

const DEFAULT_LITERATURE_PROMPT_FALLBACK = `# 文献综述知识卡片提示词

你正在分析一篇学术文献或研究报告，目标不是写泛泛摘要，而是生成一张可进入个人知识库、可用于后续综述写作和研究判断的文献分析卡片。

请把论文拆成“问题 -> 缺口 -> 贡献 -> 方法 -> 证据 -> 边界 -> 可复用价值”的研究链条。

请优先提炼以下内容：

1. 研究定位：论文研究什么问题？属于哪个领域、任务、理论或应用场景？
2. 背景与缺口：作者认为已有研究哪里不足？这个缺口是否由原文证据支撑？
3. 核心贡献：论文声称的新方法、新发现、新数据、新理论或新评估是什么？最多提炼 1-3 条。
4. 关键主张：作者真正希望读者相信什么？区分“事实发现”“因果解释”“性能提升”“适用范围”。
5. 方法与材料：使用了什么研究设计、数据、样本、实验、模型、变量、指标或案例？
6. 证据链：哪些实验结果、表格、观察、引文或理论推导支撑每个关键主张？
7. 范围校准：结论适用于什么条件？不适用于什么条件？是否存在过度概括？
8. 方法严谨性：基线、对照、消融、统计报告、可重复性、数据质量是否充分？
9. 局限与可证伪点：作者承认了哪些局限？哪些结果如果出现会削弱或推翻核心主张？
10. 综述复用：这篇文献可以放在哪类综述段落中？能支持什么论点？应与哪些相邻研究对照？

输出偏好：

- summary 写成“研究问题 + 贡献 + 证据 + 边界”的压缩摘要，避免只复述背景。
- core_points 放 3-6 条最值得保存的研究洞察，每条尽量包含主张和适用范围。
- key_arguments 放证据链、方法设计、关键结果、对照关系、局限和可能的过度主张。
- specific_actions 放后续阅读、可对照文献、可引用角度、可复现实验、可继续追问的问题。
- tags 应包含领域、任务/主题、方法、数据/对象、理论或应用场景关键词。
- quality_hint 必须说明文本是否完整、是否被截断、是否缺方法/数据/结果/局限等关键信息，以及哪些判断需要人工核查。

约束：

- 不要编造论文未提供的信息。
- 不要把作者的推测写成已被证明的事实。
- 如果只能看到摘要、引言或部分章节，要明确提示，不能假装读完整篇论文。
- 如果原文没有提供基线、样本、统计结果或实验设置，要明确标注为缺失，而不是替作者补全。`;

const GENERAL_PROMPT = `# 通用知识卡片提示词

你正在分析一段普通内容，目标是帮助用户把它沉淀为可复用的个人知识卡片。

请重点提炼：

1. 主题：这段内容主要讨论什么？
2. 核心观点：最值得保存的判断、解释或结论是什么？
3. 支撑信息：哪些事实、例子、数据或论证支持这些观点？
4. 可复用启发：它能帮助用户之后理解、判断或行动的地方是什么？
5. 后续问题：还需要查证、补充或继续追问什么？

输出偏好：

- summary 写成清晰的内容摘要。
- core_points 放最重要的观点或发现。
- key_arguments 放事实、证据、案例、原因和边界。
- specific_actions 放可执行建议、复用场景、追问方向或归档建议。
- quality_hint 说明内容是否完整、是否缺上下文、是否需要人工核查。

不要编造原文没有的信息。`;

const NEWS_PROMPT = `# 新闻内容知识卡片提示词

你正在分析一篇新闻、报道、公告或事件类内容，目标是帮助用户快速理解事件本身、背景和后续影响。

请重点提炼：

1. 发生了什么：事件、决策、声明或变化是什么？
2. 关键主体：涉及哪些人、组织、公司、地区或机构？
3. 时间与地点：事件发生或发布的具体时间、地点和阶段。
4. 背景原因：这件事为什么重要，前因是什么？
5. 证据来源：原文给出了哪些事实、数据、引述或官方说法？
6. 影响范围：可能影响哪些人、行业、市场、政策或产品？
7. 不确定性：哪些信息仍待确认，哪些说法需要继续核查？

输出偏好：

- summary 写成新闻简报式摘要，避免观点化标题党。
- core_points 放事件事实和关键变化。
- key_arguments 放数据、引述、官方信息、相关背景和争议点。
- specific_actions 放后续观察点、需要追踪的主体、需要核查的问题。
- tags 应包含事件主题、机构/公司、地区、行业或政策关键词。
- quality_hint 说明是否缺少日期、来源、原文上下文或关键证据。

不要把推测写成事实。`;

const SOCIAL_MEDIA_PROMPT = `# 社交媒体内容知识卡片提示词

你正在分析一条或一组社交媒体内容，目标是帮助用户把碎片化表达转成可保存的洞察、观点或行动线索。

请重点提炼：

1. 核心主张：作者真正想表达的观点是什么？
2. 语境：这条内容回应了什么话题、趋势、争议或场景？
3. 可验证信息：哪些事实、经验、数据或案例值得保留？
4. 情绪与立场：原文的态度、利益视角或表达目的是什么？
5. 可复用启发：对产品、写作、研究、决策或个人行动有什么启发？
6. 风险与噪音：哪些内容可能是营销、情绪化表达、未经证实或缺上下文？

输出偏好：

- summary 用中性语言复述内容，不放大情绪。
- core_points 放可保存的观点、观察或结论。
- key_arguments 放作者给出的理由、案例、经验和隐含假设。
- specific_actions 放可尝试的做法、后续核查、可扩写选题或归档线索。
- tags 应包含平台/话题/人物/领域关键词。
- quality_hint 说明是否存在断章取义、来源不足、缺少上下文或强主观表达。

不要替原文补充不存在的事实。`;

export const BUILT_IN_ANALYSIS_PROMPTS: BuiltInAnalysisPrompt[] = [
	{
		id: "general",
		label: "通用内容",
		description: "适合文章、笔记、网页摘录等没有强类型的内容。",
		fallback: GENERAL_PROMPT,
	},
	{
		id: "news",
		label: "新闻 / 事件",
		description: "适合新闻报道、公告、政策、公司动态和事件追踪。",
		fallback: NEWS_PROMPT,
	},
	{
		id: "literature-review",
		label: "论文 / 文献",
		description: "适合学术论文、PDF 文献、研究报告和综述材料。",
		fallback: DEFAULT_LITERATURE_PROMPT_FALLBACK,
		bundledPath: "prompts/literature-review.md",
	},
	{
		id: "social-media",
		label: "社交媒体",
		description: "适合帖子、推文、小红书笔记、评论串和碎片化观点。",
		fallback: SOCIAL_MEDIA_PROMPT,
	},
];

export function isBuiltInAnalysisPromptId(value: string): value is BuiltInAnalysisPromptId {
	return BUILT_IN_ANALYSIS_PROMPTS.some((prompt) => prompt.id === value);
}

export async function loadAnalysisPrompt(options: {
	app: App;
	mode: AnalysisPromptMode;
	builtInPromptId?: BuiltInAnalysisPromptId;
	vaultPromptPath: string;
	manualPrompt: string;
}): Promise<string> {
	if (options.mode === "manual") {
		return options.manualPrompt.trim();
	}

	if (options.mode === "vault-md") {
		return loadVaultMarkdownPrompt(options.app, options.vaultPromptPath);
	}

	return loadBuiltInPrompt(
		options.app,
		options.mode === "default"
			? DEFAULT_BUILT_IN_PROMPT_ID
			: options.builtInPromptId ?? DEFAULT_BUILT_IN_PROMPT_ID,
	);
}

async function loadBuiltInPrompt(app: App, id: BuiltInAnalysisPromptId): Promise<string> {
	const prompt = getBuiltInPrompt(id);

	if (!prompt.bundledPath) {
		return prompt.fallback;
	}

	const path = normalizePath(`${app.vault.configDir}/plugins/recallkit/${prompt.bundledPath}`);

	try {
		return await app.vault.adapter.read(path);
	} catch (_error) {
		return prompt.fallback;
	}
}

function getBuiltInPrompt(id: BuiltInAnalysisPromptId): BuiltInAnalysisPrompt {
	const prompt = BUILT_IN_ANALYSIS_PROMPTS.find((item) => item.id === id);
	if (prompt) {
		return prompt;
	}

	return BUILT_IN_ANALYSIS_PROMPTS[0] as BuiltInAnalysisPrompt;
}

async function loadVaultMarkdownPrompt(app: App, path: string): Promise<string> {
	if (!path) {
		throw new Error("请选择一个 Markdown 提示词文件。");
	}

	const file = app.vault.getFileByPath(path);
	if (!(file instanceof TFile) || file.extension.toLowerCase() !== "md") {
		throw new Error("请选择 vault 中的 Markdown 提示词文件。");
	}

	return app.vault.read(file);
}
