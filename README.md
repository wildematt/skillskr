<p align="center">
  <img src="./public/skillskr-logo.png" alt="SkillSkr Logo" style="width: 128px; height: 128px;" />
</p>

<h1 align="center">SkillSkr</h1>

<p align="center">
  <a href="./README.zh-CN.md">中文说明</a>
  | <a href="https://github.com/wildematt/skillskr/releases">Download</a>
</p>

![SkillSkr UI](./public/ui.jpg)

SkillSkr is a desktop app for browsing, managing, editing, and organizing AI agent skills across multiple local sources (Codex, Claude, Cursor, Windsurf, Agents, and project-local skill folders).

Built with Tauri + React, it provides a fast native shell with modern UI, markdown editing/preview, favorites, collections, and skill-level file operations.

## Features

- Multi-source skill discovery
- Skill search and filtering (Library / Tools / Collections)
- Favorites and custom Collections
- Collection management (create, rename, delete, assign)
- Markdown editing and preview
- Frontmatter-aware preview (hides YAML frontmatter in preview mode)
- Right-click actions (Show in Finder, Delete)
- Open skill folder in system file manager
- Update skill repositories via Git

## Tech Stack

- Tauri v2 (Rust backend + desktop shell)
- React 19 + TypeScript + Vite
- HeroUI + Tailwind CSS
- @lobehub/icons + @phosphor-icons/react

## Prerequisites

- Node.js 18+
- npm 9+
- Rust stable toolchain
- Tauri v2 build dependencies for your OS

## Quick Start

```bash
npm install
npm run tauri dev
```

## Build

```bash
npm run build
npm run tauri build
```

## Scripts

- `npm run dev`: start Vite dev server
- `npm run build`: type-check + production web build
- `npm run preview`: preview production web build
- `npm run tauri dev`: run desktop app in development
- `npm run tauri build`: build desktop bundles

## Open Source License

This project is open sourced under the **MIT License**.

You are free to use, modify, distribute, and use this project commercially. See [LICENSE](./LICENSE) for details.

## Notes for Contributors

Please do not commit local personal environment or generated artifacts (such as `.codex/`, `.claude/`, `dist/`, `target/`, etc.). The repository includes a `.gitignore` configured for this.
