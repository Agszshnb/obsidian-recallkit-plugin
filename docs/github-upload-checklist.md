# GitHub 上传与发布清单

最后更新：2026-05-01

这份文档是 RecallKit Obsidian 插件的 GitHub 同步规则。以后涉及“上传 GitHub”“同步仓库”“发 release”，以这里为准。

## 两种上传不要混用

### 1. 日常同步源码到 GitHub

用途：保存项目源码、文档和协作上下文。

应该提交：

- `src/`
- `prompts/`
- `scripts/`
- `manifest.json`
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `esbuild.config.mjs`
- `version-bump.mjs`
- `versions.json`
- `styles.css`
- `README.md`
- `README.en.md`
- `AGENTS.md`
- `docs/`
- `.gitignore`
- `LICENSE`

不要提交：

- `node_modules/`
- `dist/`
- `main.js`
- `data.json`
- `pdf.worker.min.mjs`
- `*.map`
- 编辑器和系统临时文件，例如 `.vscode/`、`.idea/`、`.DS_Store`、`Thumbs.db`

说明：

- `main.js` 是构建产物，日常源码同步不提交。
- `dist/` 是 release 暂存目录，日常源码同步不提交。
- `data.json` 是本地 Obsidian 插件设置数据，不提交。

## 2. GitHub Release 上传资产

用途：给用户手动安装 Obsidian 插件。

先运行：

```powershell
npm run release:stage
```

然后从 `dist/recallkit-<version>/` 上传这些 release 资产：

- `manifest.json`
- `main.js`
- `styles.css`
- `prompts/literature-review.md`

可选同时参考：

- `release-notes.md`

不要把整个 `dist/` 目录提交进源码仓库。`dist/` 只用于整理 release 上传文件。

## 发布前检查

1. `manifest.json` 的 `version` 与 GitHub release tag 完全一致。
2. Release tag 不加 `v`，例如使用 `0.1.0`，不要使用 `v0.1.0`。
3. 已运行 `npm run build` 或 `npm run release:stage`。
4. `dist/recallkit-<version>/` 中存在 `manifest.json`、`main.js`、`styles.css` 和 `prompts/literature-review.md`。
5. README 的安装说明与 release 资产一致。
6. `docs/progress.md` 已记录本阶段完成内容和已知限制。

## 文档维护规则

- 如果日常源码同步范围变化，更新本文件的“日常同步源码到 GitHub”。
- 如果 release 资产变化，更新本文件、“README 安装说明”和 `scripts/stage-release.mjs`。
- 如果只是阶段进度变化，更新 `docs/progress.md`，不要塞进 README。
- 如果只是 AI 接手规则变化，更新 `AGENTS.md`。
