# SkillSkr

[English README](./README.md)

SkillSkr 是一个桌面应用，用于浏览、管理、编辑和组织本地多来源的 AI Agent Skills（Codex、Claude、Cursor、Windsurf、Continue、Agents 以及项目内 Skills 目录）。

项目基于 Tauri + React 构建，提供原生桌面性能与现代化 UI，支持 Markdown 编辑/预览、收藏、分类管理，以及技能文件操作。

## 功能特性

- 多来源 Skills 自动发现
- Skills 搜索与筛选（Library / Tools / Collections）
- 收藏（Favorites）与自定义分类（Collections）
- 分类管理（新建、重命名、删除、归类）
- Markdown 编辑与预览
- 预览模式自动隐藏 YAML Frontmatter
- 右键操作（Show in Finder、Delete）
- 在系统文件管理器中打开技能目录
- 基于 Git 的技能仓库更新

## 技术栈

- Tauri v2（Rust 后端 + 桌面壳）
- React 19 + TypeScript + Vite
- HeroUI + Tailwind CSS
- @lobehub/icons + @phosphor-icons/react

## 环境要求

- Node.js 18+
- npm 9+
- Rust 稳定版工具链
- 对应系统的 Tauri v2 构建依赖

## 快速启动

```bash
npm install
npm run tauri dev
```

## 构建发布

```bash
npm run build
npm run tauri build
```

## 常用脚本

- `npm run dev`：启动 Vite 开发服务
- `npm run build`：类型检查 + 前端生产构建
- `npm run preview`：预览前端生产构建
- `npm run tauri dev`：启动桌面开发模式
- `npm run tauri build`：打包桌面应用

## 开源协议说明

本项目使用 **MIT License** 开源。

你可以自由使用、修改、分发本项目，也可以用于商业用途。详细条款见 [LICENSE](./LICENSE)。

## 贡献说明

请不要提交本地个人环境目录或构建产物（例如 `.codex/`、`.claude/`、`dist/`、`target/` 等）。仓库已通过 `.gitignore` 进行忽略配置。
