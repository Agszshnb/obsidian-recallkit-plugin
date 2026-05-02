import { App, PluginSettingTab, Setting } from "obsidian";
import RecallKitPlugin from "./main";
import {
	BUILT_IN_ANALYSIS_PROMPTS,
	DEFAULT_BUILT_IN_PROMPT_ID,
	isBuiltInAnalysisPromptId,
} from "./prompts";
import type { BuiltInAnalysisPromptId } from "./prompts";

export interface RecallKitSettings {
	provider: "openai-compatible";
	baseUrl: string;
	apiKey: string;
	model: string;
	pdfParser: "pdfjs" | "mineru-cloud";
	mineruApiToken: string;
	mineruModelVersion: "vlm" | "pipeline";
	mineruEnableOcr: boolean;
	mineruEnableTable: boolean;
	mineruEnableFormula: boolean;
	mineruLanguage: string;
	mineruPollTimeoutSeconds: number;
	mineruSaveMarkdown: boolean;
	mineruOutputFolder: string;
	defaultPromptId: BuiltInAnalysisPromptId;
	outputFolder: string;
	defaultTags: string;
	openAfterCreate: boolean;
}

export const DEFAULT_SETTINGS: RecallKitSettings = {
	provider: "openai-compatible",
	baseUrl: "https://api.deepseek.com",
	apiKey: "",
	model: "deepseek-chat",
	pdfParser: "pdfjs",
	mineruApiToken: "",
	mineruModelVersion: "vlm",
	mineruEnableOcr: false,
	mineruEnableTable: true,
	mineruEnableFormula: true,
	mineruLanguage: "ch",
	mineruPollTimeoutSeconds: 600,
	mineruSaveMarkdown: true,
	mineruOutputFolder: "RecallKit Sources",
	defaultPromptId: DEFAULT_BUILT_IN_PROMPT_ID,
	outputFolder: "RecallKit Cards",
	defaultTags: "recallkit",
	openAfterCreate: true,
};

export class RecallKitSettingTab extends PluginSettingTab {
	plugin: RecallKitPlugin;

	constructor(app: App, plugin: RecallKitPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setName("RecallKit").setHeading();
		containerEl.createEl("p", {
			cls: "recallkit-setting-note",
			text: "RecallKit 会把待分析内容发送到你在这里配置的 OpenAI-compatible 模型服务。API Key 只保存在 Obsidian 插件设置里，不会写入 Markdown 卡片。",
		});

		new Setting(containerEl)
			.setName("API 服务类型")
			.setDesc("第一版支持 OpenAI-compatible API。")
			.addText((text) => {
				text
					.setValue(this.plugin.settings.provider)
					.setDisabled(true);
			});

		new Setting(containerEl)
			.setName("API base URL")
			.setDesc("示例：https://api.deepseek.com")
			.addText((text) => {
				text
					.setPlaceholder("https://api.deepseek.com")
					.setValue(this.plugin.settings.baseUrl)
					.onChange(async (value) => {
						this.plugin.settings.baseUrl = value.trim();
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("API Key")
			.setDesc("保存在本地 Obsidian 插件数据中。")
			.addText((text) => {
				text.inputEl.type = "password";
				text
					.setPlaceholder("sk-...")
					.setValue(this.plugin.settings.apiKey)
					.onChange(async (value) => {
						this.plugin.settings.apiKey = value.trim();
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("模型")
			.setDesc("示例：deepseek-chat")
			.addText((text) => {
				text
					.setPlaceholder("deepseek-chat")
					.setValue(this.plugin.settings.model)
					.onChange(async (value) => {
						this.plugin.settings.model = value.trim();
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl).setName("PDF 解析").setHeading();
		containerEl.createEl("p", {
			cls: "recallkit-setting-note",
			text: "PDF 可以使用内置 pdf.js 在本地提取文字，也可以上传所选 vault PDF 到 MinerU 云端 API 进行版面解析。",
		});

		new Setting(containerEl)
			.setName("PDF 解析器")
			.setDesc("pdf.js 完全本地运行，但只适合文本型 PDF。MinerU 云端支持 OCR、公式、表格和复杂版面。")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("pdfjs", "内置 pdf.js")
					.addOption("mineru-cloud", "MinerU 云端 API")
					.setValue(this.plugin.settings.pdfParser)
					.onChange(async (value) => {
						this.plugin.settings.pdfParser = value as RecallKitSettings["pdfParser"];
						await this.plugin.saveSettings();
						this.display();
					});
			});

		if (this.plugin.settings.pdfParser === "mineru-cloud") {
			new Setting(containerEl)
				.setName("MinerU API Token")
				.setDesc("保存在本地 Obsidian 插件数据中，仅用于 MinerU 文档解析。")
				.addText((text) => {
					text.inputEl.type = "password";
					text
						.setPlaceholder("MinerU Token")
						.setValue(this.plugin.settings.mineruApiToken)
						.onChange(async (value) => {
							this.plugin.settings.mineruApiToken = value.trim();
							await this.plugin.saveSettings();
						});
				});

			new Setting(containerEl)
				.setName("MinerU 模型")
				.setDesc("推荐使用 vlm 获得更高保真的解析结果；pipeline 更快、更保守。")
				.addDropdown((dropdown) => {
					dropdown
						.addOption("vlm", "vlm")
						.addOption("pipeline", "pipeline")
						.setValue(this.plugin.settings.mineruModelVersion)
						.onChange(async (value) => {
							this.plugin.settings.mineruModelVersion = value as RecallKitSettings["mineruModelVersion"];
							await this.plugin.saveSettings();
						});
				});

			new Setting(containerEl)
				.setName("OCR")
				.setDesc("扫描版 PDF 请开启 OCR。")
				.addToggle((toggle) => {
					toggle
						.setValue(this.plugin.settings.mineruEnableOcr)
						.onChange(async (value) => {
							this.plugin.settings.mineruEnableOcr = value;
							await this.plugin.saveSettings();
						});
				});

			new Setting(containerEl)
				.setName("表格识别")
				.addToggle((toggle) => {
					toggle
						.setValue(this.plugin.settings.mineruEnableTable)
						.onChange(async (value) => {
							this.plugin.settings.mineruEnableTable = value;
							await this.plugin.saveSettings();
						});
				});

			new Setting(containerEl)
				.setName("公式识别")
				.addToggle((toggle) => {
					toggle
						.setValue(this.plugin.settings.mineruEnableFormula)
						.onChange(async (value) => {
							this.plugin.settings.mineruEnableFormula = value;
							await this.plugin.saveSettings();
						});
				});

			new Setting(containerEl)
				.setName("文档语言")
				.setDesc("MinerU 语言代码。常用值：ch、en、japan、korean、latin。")
				.addText((text) => {
					text
						.setPlaceholder("ch")
						.setValue(this.plugin.settings.mineruLanguage)
						.onChange(async (value) => {
							this.plugin.settings.mineruLanguage = value.trim() || "ch";
							await this.plugin.saveSettings();
						});
				});

			new Setting(containerEl)
				.setName("轮询超时时间")
				.setDesc("等待 MinerU 解析完成的最长秒数。")
				.addText((text) => {
					text
						.setPlaceholder("600")
						.setValue(String(this.plugin.settings.mineruPollTimeoutSeconds))
						.onChange(async (value) => {
							const seconds = Number.parseInt(value, 10);
							this.plugin.settings.mineruPollTimeoutSeconds = Number.isFinite(seconds)
								? Math.max(seconds, 30)
								: 600;
							await this.plugin.saveSettings();
						});
				});

			new Setting(containerEl)
				.setName("保存 MinerU Markdown")
				.setDesc("生成知识卡片前，把解析得到的 full.md 保存到当前 vault。")
				.addToggle((toggle) => {
					toggle
						.setValue(this.plugin.settings.mineruSaveMarkdown)
						.onChange(async (value) => {
							this.plugin.settings.mineruSaveMarkdown = value;
							await this.plugin.saveSettings();
							this.display();
						});
				});

			if (this.plugin.settings.mineruSaveMarkdown) {
				new Setting(containerEl)
					.setName("MinerU 输出文件夹")
					.setDesc("用于保存 MinerU full.md 文件的 vault 文件夹。")
					.addText((text) => {
						text
							.setPlaceholder("RecallKit Sources")
							.setValue(this.plugin.settings.mineruOutputFolder)
							.onChange(async (value) => {
								this.plugin.settings.mineruOutputFolder = value.trim() || "RecallKit Sources";
								await this.plugin.saveSettings();
							});
					});
			}
		}

		new Setting(containerEl)
			.setName("默认内置分析模板")
			.setDesc("新建卡片弹窗默认使用的分析角度，也可以在弹窗中临时切换。")
			.addDropdown((dropdown) => {
				for (const prompt of BUILT_IN_ANALYSIS_PROMPTS) {
					dropdown.addOption(prompt.id, prompt.label);
				}

				const currentPromptId = isBuiltInAnalysisPromptId(this.plugin.settings.defaultPromptId)
					? this.plugin.settings.defaultPromptId
					: DEFAULT_BUILT_IN_PROMPT_ID;

				dropdown
					.setValue(currentPromptId)
					.onChange(async (value) => {
						if (!isBuiltInAnalysisPromptId(value)) {
							return;
						}

						this.plugin.settings.defaultPromptId = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("默认输出文件夹")
			.setDesc("文件夹不存在时，RecallKit 会自动创建。")
			.addText((text) => {
				text
					.setPlaceholder("RecallKit Cards")
					.setValue(this.plugin.settings.outputFolder)
					.onChange(async (value) => {
						this.plugin.settings.outputFolder = value.trim();
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("默认标签")
			.setDesc("多个标签用英文逗号分隔，会添加到新卡片中。")
			.addText((text) => {
				text
					.setPlaceholder("recallkit, inbox")
					.setValue(this.plugin.settings.defaultTags)
					.onChange(async (value) => {
						this.plugin.settings.defaultTags = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("创建后自动打开")
			.setDesc("写入 Markdown 后，自动打开新创建的卡片。")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.openAfterCreate)
					.onChange(async (value) => {
						this.plugin.settings.openAfterCreate = value;
						await this.plugin.saveSettings();
					});
			});
	}
}
