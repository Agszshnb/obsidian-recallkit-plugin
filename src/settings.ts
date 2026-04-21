import { App, PluginSettingTab, Setting } from "obsidian";
import RecallKitPlugin from "./main";

export interface RecallKitSettings {
	provider: "openai-compatible";
	baseUrl: string;
	apiKey: string;
	model: string;
	outputFolder: string;
	defaultTags: string;
	openAfterCreate: boolean;
}

export const DEFAULT_SETTINGS: RecallKitSettings = {
	provider: "openai-compatible",
	baseUrl: "https://api.deepseek.com",
	apiKey: "",
	model: "deepseek-chat",
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
