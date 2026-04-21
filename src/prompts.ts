import { App, normalizePath, TFile } from "obsidian";

export type AnalysisPromptMode = "default" | "vault-md" | "manual";

const DEFAULT_LITERATURE_PROMPT_FALLBACK = `# 文献综述知识卡片提示词

你正在分析一篇学术文献，目标是帮助用户快速形成可进入个人知识库的文献综述卡片。

请重点提炼：

1. 研究问题：论文试图回答什么问题？
2. 研究背景：它回应了什么理论、实践或领域缺口？
3. 方法与材料：使用了什么方法、数据、样本、实验或案例？
4. 核心发现：最重要的结论是什么？
5. 关键证据：哪些结果、论证或观察支撑了结论？
6. 局限：作者承认了什么局限，或你能从文本中看出哪些边界？
7. 可引用观点：哪些观点适合放入文献综述或后续写作？
8. 后续追问：读完这篇文献后，下一步应该追问什么？

不要编造论文未提供的信息。信息不足时请在 quality_hint 中说明。`;

export async function loadAnalysisPrompt(options: {
	app: App;
	mode: AnalysisPromptMode;
	vaultPromptPath: string;
	manualPrompt: string;
}): Promise<string> {
	if (options.mode === "manual") {
		return options.manualPrompt.trim();
	}

	if (options.mode === "vault-md") {
		return loadVaultMarkdownPrompt(options.app, options.vaultPromptPath);
	}

	return loadDefaultPrompt(options.app);
}

async function loadDefaultPrompt(app: App): Promise<string> {
	const path = normalizePath(`${app.vault.configDir}/plugins/recallkit/prompts/literature-review.md`);

	try {
		return await app.vault.adapter.read(path);
	} catch (_error) {
		return DEFAULT_LITERATURE_PROMPT_FALLBACK;
	}
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
