import { Notice, Plugin } from "obsidian";
import { RecallKitInputModal } from "./modal";
import {
	DEFAULT_SETTINGS,
	RecallKitSettingTab,
	RecallKitSettings,
} from "./settings";

export default class RecallKitPlugin extends Plugin {
	settings: RecallKitSettings;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.addRibbonIcon("archive", "创建 RecallKit 知识卡片", () => {
			this.openInputModal();
		});

		this.addCommand({
			id: "create-knowledge-card",
			name: "Create knowledge card",
			callback: () => {
				this.openInputModal();
			},
		});

		this.addCommand({
			id: "create-knowledge-card-zh",
			name: "创建知识卡片",
			callback: () => {
				this.openInputModal();
			},
		});

		this.addSettingTab(new RecallKitSettingTab(this.app, this));
	}

	onunload(): void {
		// Obsidian automatically unloads registered commands, ribbon icons, and settings tabs.
	}

	openInputModal(): void {
		new RecallKitInputModal(this.app, this).open();
	}

	async loadSettings(): Promise<void> {
		const savedSettings = (await this.loadData()) as Partial<RecallKitSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, savedSettings);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		new Notice("RecallKit 设置已保存。");
	}
}
