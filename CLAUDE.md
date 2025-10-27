# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个基于 Vite + HeroUI v2 的 React 应用模板，使用 TypeScript 和 Tailwind CSS 构建。这是一个现代化的单页面应用，具有多个页面路由（首页、文档、定价、博客、关于）。

## 技术栈架构

- **构建工具**: Vite (配置文件: `vite.config.ts`)
- **框架**: React 18 + TypeScript
- **UI 库**: HeroUI v2 (组件系统)
- **样式**: Tailwind CSS v4 + PostCSS
- **路由**: React Router DOM
- **类型检查**: TypeScript (严格模式开启)

## 常用开发命令

```bash
# 启动开发服务器
npm run dev

# 构建生产版本 (包含类型检查)
npm run build

# 代码检查和自动修复
npm run lint

# 预览构建结果
npm run preview
```

## 项目结构和架构

### 核心文件结构
- `src/main.tsx` - 应用入口点，包含 React Router 和 Provider 设置
- `src/App.tsx` - 主要路由配置
- `src/provider.tsx` - HeroUI Provider 配置，处理导航集成

### 组件架构
- `src/layouts/default.tsx` - 默认布局，包含导航栏和页脚
- `src/components/navbar.tsx` - 响应式导航栏组件
- `src/components/theme-switch.tsx` - 主题切换功能
- `src/components/icons.tsx` - 图标组件集合
- `src/components/primitives.ts` - 基础组件配置

### 页面结构
- `src/pages/` - 所有页面组件 (index, docs, pricing, blog, about)
- 每个页面使用 `DefaultLayout` 布局

### 配置文件
- `src/config/site.ts` - 站点配置（导航项、链接等）
- `src/types/index.ts` - 类型定义
- `@/*` 路径别名指向 `src/` 目录

### 样式系统
- `src/styles/globals.css` - 全局样式
- HeroUI 主题系统集成
- Tailwind CSS v4 配置

## 开发注意事项

### TypeScript 配置
- 启用严格模式
- 配置了 `noUnusedLocals` 和 `noUnusedParameters`
- 使用 `@/*` 路径别名

### HeroUI 集成
- 通过 `provider.tsx` 配置 HeroUI Provider
- 集成了 React Router 导航
- 支持主题切换功能

### 构建流程
- 先进行 TypeScript 类型检查 (`tsc`)
- 然后使用 Vite 构建
- ESLint 配置支持自动修复

## 扩展功能
- 响应式设计 (移动端菜单)
- 主题切换 (暗色/亮色模式)
- 搜索功能界面
- 社交媒体链接集成