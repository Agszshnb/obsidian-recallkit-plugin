import { App, Modal, Notice, Setting } from "obsidian";
import RecallKitPlugin from "./main";
import { createKnowledgeCard } from "./file";
import { fetchUrlContent } from "./fetch";
import { AnalysisProgress, analyzeWithOpenAICompatibleApi, RecallKitCardDraft } from "./llm";
import { buildKnowledgeCardMarkdown } from "./markdown";
import { extractTextFromVaultPdf } from "./pdf";
import {
	AnalysisPromptMode,
	BUILT_IN_ANALYSIS_PROMPTS,
	BuiltInAnalysisPromptId,
	DEFAULT_BUILT_IN_PROMPT_ID,
	isBuiltInAnalysisPromptId,
	loadAnalysisPrompt,
} from "./prompts";

type SourceType = "text" | "url" | "pdf";
type ModalState = "input" | "analyzing" | "preview";

export class RecallKitInputModal extends Modal {
	private plugin: RecallKitPlugin;
	private sourceType: SourceType = "text";
	private sourceValue = "";
	private userNote = "";
	private analysisPromptMode: AnalysisPromptMode = "built-in";
	private builtInPromptId: BuiltInAnalysisPromptId = DEFAULT_BUILT_IN_PROMPT_ID;
	private vaultPromptPath = "";
	private manualPrompt = "";
	private outputFolder = "";
	private state: ModalState = "input";
	private draft: RecallKitCardDraft | null = null;
	private markdownPreview = "";
	private analysisProgress: AnalysisProgress | null = null;

	constructor(app: App, plugin: RecallKitPlugin) {
		super(app);
		this.plugin = plugin;
		this.outputFolder = plugin.settings.outputFolder;
		this.builtInPromptId = isBuiltInAnalysisPromptId(plugin.settings.defaultPromptId)
			? plugin.settings.defaultPromptId
			: DEFAULT_BUILT_IN_PROMPT_ID;
	}

	onOpen(): void {
		this.modalEl.addClass("recallkit-modal-container");
		this.render();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("recallkit-modal");

		contentEl.createEl("h2", { text: "创建 RecallKit 知识卡片" });

		if (this.state === "preview") {
			this.renderPreview(contentEl);
			return;
		}

		new Setting(contentEl)
			.setName("我的备注")
			.setDesc("只保存到最终卡片，不会发送给大模型。")
			.addTextArea((text) => {
				text
					.setPlaceholder("可选，写下你保存这条内容的原因、归档线索或个人想法")
					.setValue(this.userNote)
					.onChange((value) => {
						this.userNote = value;
					});
			});

		new Setting(contentEl)
			.setName("来源类型")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("text", "文本")
					.addOption("url", "URL")
					.addOption("pdf", "PDF 文献")
					.setValue(this.sourceType)
					.onChange((value) => {
						this.sourceType = value as SourceType;
						if (this.sourceType === "pdf") {
							const firstPdf = this.getVaultPdfPaths()[0];
							this.sourceValue = firstPdf ?? "";
						}
						this.render();
					});
			});

		if (this.sourceType === "pdf") {
			this.renderPdfSelector(contentEl);
		} else {
			new Setting(contentEl)
				.setName("内容或 URL")
				.setDesc("文本模式会直接分析粘贴内容；URL 模式会抓取网页正文后再分析。")
				.addTextArea((text) => {
					text
						.setPlaceholder("在这里粘贴正文，或输入 https://example.com/article")
						.setValue(this.sourceValue)
						.onChange((value) => {
							this.sourceValue = value;
						});
			});
		}

		if (this.state === "analyzing") {
			this.renderAnalysisProgress(contentEl);
		}

		this.renderAnalysisPromptControls(contentEl);

		new Setting(contentEl)
			.setName("输出文件夹")
			.addText((text) => {
				text
					.setPlaceholder("RecallKit Cards")
					.setValue(this.outputFolder)
					.onChange((value) => {
						this.outputFolder = value.trim();
					});
			});

		const actionsEl = contentEl.createDiv({ cls: "recallkit-modal__actions" });
		const cancelButton = actionsEl.createEl("button", { text: "取消" });
		cancelButton.disabled = this.state === "analyzing";
		cancelButton.addEventListener("click", () => {
			this.close();
		});

		const analyzeButton = actionsEl.createEl("button", {
			text: this.state === "analyzing" ? "分析中..." : "分析",
			cls: "mod-cta",
		});
		analyzeButton.disabled = this.state === "analyzing";
		analyzeButton.addEventListener("click", () => {
			void this.analyze();
		});
	}

	private async analyze(): Promise<void> {
		if (!this.sourceValue.trim()) {
			new Notice("请先粘贴文本或 URL。");
			return;
		}

		this.state = "analyzing";
		this.analysisProgress = {
			stage: "preparing",
			message: "正在准备分析内容。",
		};
		this.render();

		try {
			this.updateAnalysisProgress({
				stage: "preparing",
				message: this.sourceType === "pdf"
					? "正在读取 PDF 并提取文字。"
					: this.sourceType === "url"
						? "正在抓取网页正文。"
						: "正在读取粘贴文本。",
			});
			const content = await this.getAnalysisContent();
			this.updateAnalysisProgress({
				stage: "preparing",
				message: "正在加载分析模板。",
			});
			const analysisPrompt = await loadAnalysisPrompt({
				app: this.app,
				mode: this.analysisPromptMode,
				builtInPromptId: this.builtInPromptId,
				vaultPromptPath: this.vaultPromptPath,
				manualPrompt: this.manualPrompt,
			});
			this.draft = await analyzeWithOpenAICompatibleApi({
				settings: this.plugin.settings,
				content,
				sourceType: this.sourceType,
				sourceUrl: this.sourceType === "url" ? this.sourceValue : "",
				analysisPrompt,
				onProgress: (progress) => {
					this.updateAnalysisProgress(progress);
				},
			});
			this.updateAnalysisProgress({
				stage: "done",
				message: "分析完成，正在生成 Markdown 预览。",
			});
			this.markdownPreview = buildKnowledgeCardMarkdown({
				draft: this.draft,
				sourceType: this.sourceType,
				sourceValue: this.sourceValue,
				userNote: this.userNote,
				defaultTags: this.plugin.settings.defaultTags,
			});
			this.state = "preview";
			this.analysisProgress = null;
			this.render();
		} catch (error) {
			this.state = "input";
			this.analysisProgress = null;
			this.render();
			new Notice(readErrorMessage(error));
		}
	}

	private updateAnalysisProgress(progress: AnalysisProgress): void {
		this.analysisProgress = progress;
		this.render();
	}

	private renderAnalysisProgress(contentEl: HTMLElement): void {
		const progress = this.analysisProgress;
		const progressEl = contentEl.createDiv({ cls: "recallkit-progress" });
		const headerEl = progressEl.createDiv({ cls: "recallkit-progress__header" });
		headerEl.createSpan({
			cls: "recallkit-progress__title",
			text: readProgressTitle(progress),
		});

		if (progress?.current !== undefined && progress.total !== undefined) {
			headerEl.createSpan({
				cls: "recallkit-progress__count",
				text: `${progress.current}/${progress.total}`,
			});
		}

		progressEl.createDiv({
			cls: "recallkit-progress__message",
			text: progress?.message ?? "正在分析。",
		});

		const trackEl = progressEl.createDiv({ cls: "recallkit-progress__track" });
		const barEl = trackEl.createDiv({ cls: "recallkit-progress__bar" });
		const ratio = progress?.current !== undefined && progress.total !== undefined
			? Math.min(progress.current / progress.total, 1)
			: undefined;
		if (ratio === undefined) {
			barEl.addClass("recallkit-progress__bar--indeterminate");
		} else {
			barEl.style.width = `${Math.max(ratio * 100, 8)}%`;
		}
	}

	private renderAnalysisPromptControls(contentEl: HTMLElement): void {
		new Setting(contentEl)
			.setName("分析 Prompt 来源")
			.setDesc("这个内容会发送给大模型，用来控制分析角度。")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("built-in", "使用内置分析模板")
					.addOption("vault-md", "从 vault 的 Markdown 文件加载")
					.addOption("manual", "现场输入")
					.setValue(this.analysisPromptMode)
					.onChange((value) => {
						this.analysisPromptMode = value as AnalysisPromptMode;
						if (this.analysisPromptMode === "vault-md" && !this.vaultPromptPath) {
							this.vaultPromptPath = this.getVaultMarkdownPaths()[0] ?? "";
						}
						this.render();
					});
			});

		if (this.analysisPromptMode === "built-in" || this.analysisPromptMode === "default") {
			this.renderBuiltInPromptSelector(contentEl);
		}

		if (this.analysisPromptMode === "vault-md") {
			this.renderVaultPromptSelector(contentEl);
		}

		if (this.analysisPromptMode === "manual") {
			new Setting(contentEl)
				.setName("现场 Prompt")
				.addTextArea((text) => {
					text
						.setPlaceholder("例如：请从产品研究角度总结，重点关注用户问题、场景、证据、启发和下一步动作。")
						.setValue(this.manualPrompt)
						.onChange((value) => {
							this.manualPrompt = value;
						});
				});
		}
	}

	private renderBuiltInPromptSelector(contentEl: HTMLElement): void {
		const selectedPrompt = BUILT_IN_ANALYSIS_PROMPTS.find((prompt) => prompt.id === this.builtInPromptId);

		new Setting(contentEl)
			.setName("内置分析模板")
			.setDesc(selectedPrompt?.description ?? "选择本次分析的内容类型和提炼角度。")
			.addDropdown((dropdown) => {
				for (const prompt of BUILT_IN_ANALYSIS_PROMPTS) {
					dropdown.addOption(prompt.id, prompt.label);
				}

				dropdown
					.setValue(this.builtInPromptId)
					.onChange((value) => {
						if (!isBuiltInAnalysisPromptId(value)) {
							return;
						}

						this.builtInPromptId = value;
						this.render();
					});
			});
	}

	private renderVaultPromptSelector(contentEl: HTMLElement): void {
		const markdownPaths = this.getVaultMarkdownPaths();

		if (!this.vaultPromptPath && markdownPaths.length > 0) {
			this.vaultPromptPath = markdownPaths[0] ?? "";
		}

		new Setting(contentEl)
			.setName("提示词 Markdown")
			.setDesc("选择当前 vault 中你自己写的 .md 提示词文件。")
			.addDropdown((dropdown) => {
				if (markdownPaths.length === 0) {
					dropdown.addOption("", "当前 vault 中没有 Markdown 文件");
				} else {
					for (const path of markdownPaths) {
						dropdown.addOption(path, path);
					}
				}

				dropdown
					.setValue(this.vaultPromptPath)
					.onChange((value) => {
						this.vaultPromptPath = value;
					});
			});
	}

	private getVaultMarkdownPaths(): string[] {
		return this.app.vault
			.getMarkdownFiles()
			.map((file) => file.path)
			.sort((left, right) => left.localeCompare(right));
	}

	private renderPdfSelector(contentEl: HTMLElement): void {
		const pdfPaths = this.getVaultPdfPaths();

		if (!this.sourceValue && pdfPaths.length > 0) {
			this.sourceValue = pdfPaths[0] ?? "";
		}

		new Setting(contentEl)
			.setName("PDF 文件")
			.setDesc("只读取当前测试 vault 中的 PDF。扫描版 PDF 需要 OCR，当前版本暂不支持。")
			.addDropdown((dropdown) => {
				if (pdfPaths.length === 0) {
					dropdown.addOption("", "当前 vault 中没有 PDF 文件");
				} else {
					for (const path of pdfPaths) {
						dropdown.addOption(path, path);
					}
				}

				dropdown
					.setValue(this.sourceValue)
					.onChange((value) => {
						this.sourceValue = value;
					});
			});
	}

	private getVaultPdfPaths(): string[] {
		return this.app.vault
			.getFiles()
			.filter((file) => file.extension.toLowerCase() === "pdf")
			.map((file) => file.path)
			.sort((left, right) => left.localeCompare(right));
	}

	private async getAnalysisContent(): Promise<string> {
		if (this.sourceType === "text") {
			return this.sourceValue;
		}

		if (this.sourceType === "url") {
			const fetched = await fetchUrlContent(this.sourceValue);
			this.sourceValue = fetched.url;
			const truncatedHint = fetched.truncated
				? "\n\n注意：URL 内容较长，插件只提取了前一部分文字。请在 quality_hint 中提醒用户。"
				: "";

			return [
				`URL：${fetched.url}`,
				fetched.title ? `标题：${fetched.title}` : "",
				`提取方式：${fetched.extractionMethod === "jina-reader" ? "Jina Reader fallback" : "direct request"}`,
				truncatedHint,
				fetched.content,
			].filter(Boolean).join("\n\n");
		}

		if (!this.sourceValue) {
			throw new Error("当前 vault 中没有可分析的 PDF 文件。请先把 PDF 放入测试 vault。");
		}

		const pdf = await extractTextFromVaultPdf(this.app, this.sourceValue);
		const truncatedHint = pdf.truncated
			? "\n\n注意：PDF 较长，插件只提取了前一部分文字。请在 quality_hint 中提醒用户。"
			: "";

		return [
			`PDF 文件：${pdf.path}`,
			`页数：${pdf.pageCount}`,
			truncatedHint,
			pdf.text,
		].filter(Boolean).join("\n\n");
	}

	private renderPreview(contentEl: HTMLElement): void {
		if (!this.draft) {
			this.state = "input";
			this.render();
			return;
		}

		new Setting(contentEl)
			.setName("标题")
			.addText((text) => {
				text
					.setValue(this.draft?.title ?? "")
					.onChange((value) => {
						if (!this.draft) {
							return;
						}
						this.draft.title = value.trim() || "Untitled knowledge card";
						this.rebuildPreview();
					});
			});

		new Setting(contentEl)
			.setName("标签")
			.setDesc("多个标签用英文逗号分隔。")
			.addText((text) => {
				text
					.setValue(this.draft?.tags.join(", ") ?? "")
					.onChange((value) => {
						if (!this.draft) {
							return;
						}
						this.draft.tags = value
							.split(",")
							.map((tag) => tag.trim())
							.filter((tag) => tag.length > 0);
						this.rebuildPreview();
					});
			});

		new Setting(contentEl)
			.setName("Markdown 预览")
			.addTextArea((text) => {
				text
					.setValue(this.markdownPreview)
					.onChange((value) => {
						this.markdownPreview = value;
					});
				text.inputEl.addClass("recallkit-modal__preview");
		});

		const actionsEl = contentEl.createDiv({ cls: "recallkit-modal__actions" });
		const backButton = actionsEl.createEl("button", { text: "返回修改" });
		backButton.addEventListener("click", () => {
			this.state = "input";
			this.render();
		});

		const saveButton = actionsEl.createEl("button", {
			text: "保存卡片",
			cls: "mod-cta",
		});
		saveButton.addEventListener("click", () => {
			void this.saveCard();
		});
	}

	private rebuildPreview(): void {
		if (!this.draft) {
			return;
		}

		this.markdownPreview = buildKnowledgeCardMarkdown({
			draft: this.draft,
			sourceType: this.sourceType,
			sourceValue: this.sourceValue,
			userNote: this.userNote,
			defaultTags: this.plugin.settings.defaultTags,
		});
	}

	private async saveCard(): Promise<void> {
		if (!this.draft) {
			new Notice("当前没有可保存的卡片草稿。");
			return;
		}

		const createdFile = await createKnowledgeCard({
			app: this.app,
			folder: this.outputFolder || this.plugin.settings.outputFolder,
			title: this.draft.title,
			markdown: this.markdownPreview,
		});

		new Notice(`RecallKit 卡片已创建：${createdFile.path}`);

		if (this.plugin.settings.openAfterCreate) {
			await this.app.workspace.getLeaf(false).openFile(createdFile);
		}

		this.close();
	}
}

function readErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : "RecallKit 分析失败。";
}

function readProgressTitle(progress: AnalysisProgress | null): string {
	if (!progress) {
		return "正在分析";
	}

	if (progress.stage === "preparing") {
		return "准备内容";
	}

	if (progress.stage === "single-pass") {
		return "模型分析";
	}

	if (progress.stage === "chunking") {
		return "切分长文档";
	}

	if (progress.stage === "chunk") {
		return "分段分析";
	}

	if (progress.stage === "synthesizing") {
		return "综合结果";
	}

	return "生成预览";
}
