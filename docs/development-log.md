# ClaudeForge 开发日志

## 项目概述

**ClaudeForge** — Windows 暗黑主题 AI IDE，内嵌 PowerShell + Claude CLI 终端、CodeMirror 6 代码编辑器（替代 Monaco）、文件浏览器。Apple 风格极简设计，Framer Motion 丝滑动效。

- 项目路径: `D:\ClaudeProjectFolder\claudeforge\`
- 技术栈: Electron + React 19 + TypeScript + Vite
- 当前版本: v1.0.0

---

## 技术架构速查

| 模块 | 技术 | 用途 |
|------|------|------|
| 桌面框架 | Electron 43 | 窗口管理、原生对话框、系统集成 |
| UI | React 19 + TypeScript | 组件化 UI |
| 终端 | xterm.js + @lydell/node-pty | PowerShell PTY 嵌入，自动启动 Claude |
| 编辑器 | CodeMirror 6 (@codemirror/*) | 40+ 语言语法高亮，暗黑主题 |
| (原 Monaco Editor 已移除) | (~20MB → ~300KB) | notepad-- 风格功能增强 |
| 状态管理 | Zustand 5 | 轻量状态，无 Provider |
| 动画 | Framer Motion 12 | 面板切换、展开/折叠动画 |
| 样式 | Tailwind CSS 3 + CSS 自定义属性 | 暗黑玻璃拟态 |
| 文件监听 | chokidar 4 | 目录实时更新 |
| 打包 | electron-builder 25 | NSIS/便携式 Windows 安装包 |
| 包管理 | Vite 6 + vite-plugin-electron | 主进程/预加载/渲染进程统一构建 |

---

## 项目结构

```
claudeforge/
├── package.json                    # 依赖和脚本
├── vite.config.ts                  # Vite + Electron 插件配置
├── electron-builder.yml            # 打包配置（NSIS/portable）
├── tailwind.config.js              # Tailwind 暗黑主题色
├── index.html                      # 入口 HTML
├── src/
│   ├── main/                       # Electron 主进程
│   │   ├── main.ts                 # 窗口创建、生命周期
│   │   ├── ipc/
│   │   │   ├── terminal.ipc.ts     # 终端 IPC（创建/写入/调整/终止）
│   │   │   ├── filesystem.ipc.ts   # 文件系统 IPC（列表/读/写/删/改名）
│   │   │   ├── dialog.ipc.ts       # 原生对话框 IPC（选择文件夹）
│   │   │   └── window.ipc.ts       # 窗口控制 IPC（最小化/最大化/关闭）
│   │   └── services/
│   │       ├── terminal-manager.ts # PTY 会话管理（spawn/write/resize/kill）
│   │       └── file-indexer.ts     # 全盘文件索引引擎（自建 Everything 对标）
│   ├── preload/
│   │   └── preload.ts              # contextBridge 安全桥接
│   ├── renderer/
│   │   ├── main.tsx                # React 入口
│   │   ├── App.tsx                 # 根组件（布局编排、终端共享）
│   │   ├── components/
│   │   │   ├── layout/             # AppShell, PanelResizer
│   │   │   ├── terminal/           # TerminalPanel, XTerm, TerminalTabs
│   │   │   ├── editor/             # EditorPanel, MonacoEditor, EditorTabs
│   │   │   ├── filesystem/         # FileBrowser, AddressBar, FileTree, FileRow, FavoritesButton
│   │   │   └── onboarding/         # FolderPicker（首次引导）
│   │   ├── stores/                 # Zustand 状态管理
│   │   │   ├── useProjectStore.ts  # 项目路径、引导状态
│   │   │   ├── useTerminalStore.ts # 终端标签页、会话 ID
│   │   │   ├── useEditorStore.ts   # 打开文件、激活标签、脏状态
│   │   │   ├── useFileStore.ts     # 当前目录、文件列表、选中路径
│   │   │   └── useLayoutStore.ts   # 面板宽度
│   │   ├── styles/
│   │   │   └── index.css           # Tailwind + 玻璃拟态 + 自定义滚动条
│   │   └── types/
│   │       └── electron.d.ts       # window.electronAPI 类型声明
│   └── shared/
│       ├── ipc-channels.ts         # IPC 通道名常量
│       └── types.ts                # 共享类型（FileEntry, EditorTab 等）
```

---

## 关键设计决策与踩坑记录

### 1. node-pty 原生模块编译

**问题**: `node-pty` 需要 Visual Studio Build Tools 编译，当前环境没有 VS。

**解决**: 使用 `@lydell/node-pty`（v1.2.0-beta.12），提供 Windows 预编译二进制，无需本地编译。

### 2. Preload 脚本路径错误（首次重大 Bug）

**问题**: 选择文件夹按钮点击无反应，所有 IPC 调用静默失败。

**根因**: `main.ts` 中 preload 路径写成 `path.join(__dirname, '../preload/preload.js')`，但 `main.js` 和 `preload.js` 都在 `dist-electron/` 下，正确路径是 `path.join(__dirname, 'preload.js')`。

**修复**: 改为 `path.join(__dirname, 'preload.js')`。

### 3. 终端 Session 重置（第二次重大 Bug）

**问题**: 每次打开/关闭文件，左侧终端 session 就被销毁重建，Claude 重新启动。

**根因**: `App.tsx` 使用 `AnimatePresence mode="wait"` 在 TwoPanelLayout 和 ThreePanelLayout 之间切换时，完全卸载并重新挂载 TerminalPanel，本地 state 丢失。

**修复**:
- 终端状态移到 Zustand store (`useTerminalStore.ts`)
- TerminalPanel 提升到 App 级别，在两布局间共享
- 编辑器面板改为 AnimatePresence 滑入/滑出，不影响终端

### 4. 文件预览静默失败

**问题**: 双击文件无反应，没有任何提示。

**根因**: `FileTree.handleDoubleClick` 中 `fs.read` 异常被 `catch {}` 静默吞掉；选中状态用 `getState()` 快照不触发重渲染。

**修复**:
- 增加文本文件扩展名白名单（40+ 种）
- 非文本文件/读取失败显示黄色错误提示
- `selectedPath` 通过 Zustand hook 响应式订阅

### 5. 终端高度不占满

**问题**: xterm 终端容器高度为 0，不填充面板。

**修复**: XTerm 容器改为 `position: absolute; inset: 0`，用 `requestAnimationFrame` 延迟 fit 确保 DOM 已渲染。

### 6. 打包环境限制

**问题**: electron-builder 打包 NSIS 安装器时，winCodeSign 的 7z 包内含 macOS 符号链接（.dylib），Windows 无管理员权限无法创建符号链接，导致 7za 提取失败。

**当前方案**: 使用 `--dir` 打包到 `win-unpacked/` 目录，手动 zip 分发。用户本地有完整权限可运行 `npm run electron:build:win` 生成安装器。

**win-unpacked 产物位置**: `release/win-unpacked/ClaudeForge.exe`

---

## 构建和运行

```bash
# 开发模式（热重载）
cd D:\ClaudeProjectFolder\claudeforge
npm run dev

# 生产构建
npm run build          # 仅 Vite 构建
npm run electron:build:win  # 完整打包（含 NSIS 安装器）

# 当前环境打包（跳过签名）
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npx electron-builder --win --dir
# 产物: release/win-unpacked/ClaudeForge.exe
```

---

## 已修复的 Bug 清单

| # | 日期 | 问题 | 根因 | 修复方式 |
|---|------|------|------|---------|
| 1 | 2026-07-01 | 选择文件夹按钮无反应 | preload 路径错误 | 修正为 `path.join(__dirname, 'preload.js')` |
| 2 | 2026-07-01 | 终端 Session 重置 | layout 切换卸载 TerminalPanel | 终端状态提升到 Zustand，面板常驻 App 级别 |
| 3 | 2026-07-01 | 文件无法预览 | 异常静默吞掉 + 选中状态不响应 | 白名单 + 错误提示 + 响应式选中 |
| 4 | 2026-07-01 | 终端高度不占满 | xterm 容器高度为 0 | absolute 定位 + rAF fit |
| 5 | 2026-07-01 | 终端面板再次丢失高度 | motion.div layout 动画干扰 flex | 常驻面板改为普通 div |
| 6 | 2026-07-01 | 所有文本文件无法预览编辑 | width 动画与 flex 冲突 | opacity-only 动画 + key={fileId} + 二进制检测 |
| 7 | 2026-07-01 | 地址栏输入路径无反应 | entries.length 守卫阻止重载 | 移除条件，rootPath 变化始终重载 |
| 8 | 2026-07-01 | 收藏夹无交互、不显示 | 本地 state 无共享/无 UI | Zustand store + 模态对话框 + FavoritesBar |
| 9 | 2026-07-02 | 搜索"下一个"光标不跳转 | handleFindNext/Prev 只是光标 +/-1 | 改用 CM6 `setSearchQuery` + `findNext`/`findPrevious` |
| 10 | 2026-07-02 | 列编辑模式不生效 | `rectangularSelection` 动态添加失败 + 事件冲突 | 移入核心始终可用；全局 Ctrl+F/G 拦截移除 |
| 11 | 2026-07-03 | 终端改名需按回车才生效 | 容器点击未触发 blur | 容器 div 添加 onClick 自动提交 |
| 12 | 2026-07-03 | 改名后终端无法输入 | 焦点未返回 xterm | forwardRef + useImperativeHandle 暴露 focus 方法 |

---

## 重大变更：编辑器基础架构升级（2026-07-02）

**变更**: Monaco Editor → CodeMirror 6 + notepad-- 能力集成

**动机**: 用户希望用国产 notepad-- 编辑器的理念替换 Monaco Editor

**方案**: 采用 CodeMirror 6（TypeScript 原生，~300KB）作为 web 端 Scintilla 替代

### 变更清单

| 操作 | 详情 |
|------|------|
| 移除 | `@monaco-editor/react` 依赖 (~20MB) |
| 移除 | `public/monaco-vs/` 目录 (~20MB), `copy:monaco` script |
| 删除 | `MonacoEditor.tsx` |
| 新增 | CodeMirror 6 核心 + 15 个语言包 |
| 新增 | `CodeMirrorTheme.ts` — MLX 暗黑主题 |
| 新增 | `CodeMirrorLanguageSupport.ts` — 语言映射 |
| 新增 | `NddEditor.tsx` — CM6 核心编辑器 |
| 新增 | `NddFindPanel.tsx` — 查找替换面板 (Docked) |
| 新增 | `NddStatusBar.tsx` — 状态栏 (Ln:Col/编码/语言/缩放) |
| 新增 | `NddHexViewer.tsx` — 十六进制查看器 |
| 新增 | `NddLineOps.tsx` — 行操作菜单 |
| 重构 | `EditorPanel.tsx` — 集成所有新组件 |
| 增强 | `useEditorStore.ts` — 新增状态字段 |
| 扩展 | IPC: `fs.readBinary`, `fs.getFileInfo` |

### notepad-- 能力映射

| 能力 | 状态 | 实现 |
|------|------|------|
| 文本编辑 + 语法高亮 40+ 语言 | ✅ P0 | CodeMirror 6 + 语言包 |
| 查找/替换 (大小写/全词/正则) | ✅ P0 | NddFindPanel + CM6 search |
| 状态栏 (Ln:Col/编码/换行/语言/缩放) | ✅ P0 | NddStatusBar |
| 暗黑主题配色一致 | ✅ P0 | CodeMirrorTheme.ts |
| HEX 十六进制查看器 | ✅ P1 | NddHexViewer |
| 编码选择 (UTF-8/GBK/Big5...) | ✅ P1 | NddStatusBar 下拉 |
| 换行符 (LF/CRLF/CR) | ✅ P1 | NddStatusBar 下拉 |
| 行操作 (排序/去重/大小写) | ✅ P2 | NddLineOps |
| 大文件只读 | ⏳ P1 | FileTree.tsx 已有逻辑 |
| XML/JSON 格式化 | 📅 P2 | 待实现 |
| 列编辑模式 (Alt+拖拽矩形选择) | ✅ P2 | `rectangularSelection()` + `drawSelection()` 核心扩展，列模式按钮控制视觉反馈 |
| 查找下一个/上一个 (光标跳转) | ✅ P0 | CM6 `setSearchQuery` + `findNext`/`findPrevious` 命令 |
| 外部修改监听 | 📅 P2 | 待实现 (chokidar) |

---

## CodeMirror 6 编辑器架构理解（2026-07-02）

### 核心架构

```
EditorPanel (容器层)
  ├── EditorToolbar    — 工具栏按钮（查找/换行/列模式/缩放）
  ├── EditorTabs       — 文件标签栏
  ├── NddFindPanel     — 查找替换面板（React 自定义 UI，非 CM6 默认 panel）
  ├── NddEditor        — CM6 编辑器实例（核心）
  │   ├── EditorView     — CM6 视图层
  │   ├── EditorState    — CM6 状态层（doc, selection, extensions）
  │   └── Compartments   — 动态切换扩展的机制
  ├── NddHexViewer     — 十六进制查看器（替代模式）
  ├── PluginPreview    — Markdown/PlantUML 预览
  └── NddStatusBar     — 状态栏（Ln:Col/编码/换行/列模式/缩放）
```

### EditorPanel ↔ NddEditor 通信方式

| 方向 | 方式 | 用途 |
|------|------|------|
| 父→子 | React Props | `content`, `language`, `columnMode`, `wordWrap` 等 |
| 子→父 | 回调 Props | `onChange`, `onCursorChange` |
| 父操作子 | `onEditorViewReady` 暴露 `EditorView` 引用 | `editorViewRef` 直接调用 CM6 API |

**关键设计**：查找面板的操作（findNext/findPrevious/replace）不通过 React 状态驱动，而是通过 `editorViewRef` 直接操作 CM6 实例。这意味着查找性能不受 React 渲染周期影响，但要求 ref 必须保持最新。

### NddFindPanel 搜索流程

```
用户输入搜索词
  → handleQueryChange → onFind(query, options)
    → handleFind():
        1. new SearchQuery({search, caseSensitive, regexp, wholeWord})
        2. view.dispatch({ effects: setSearchQuery.of(searchQuery) })
           // 将查询写入 CM6 searchState，后续 findNext/findPrevious 依赖此状态
        3. 正则匹配全文统计匹配数 → setMatchCount(count)
        4. findNext(view) → 光标跳转到第一个匹配

用户点击"下一个" / 按 Enter
  → onFindNext → handleFindNext()
    → findNext(view)  // CM6 原生命令，自动滚动到匹配

用户点击"上一个" / 按 Shift+Enter
  → onFindPrev → handleFindPrev()
    → findPrevious(view)

用户点击"替换"
  → onReplace(replaceText) → handleReplace()
    → 替换当前选中区域，光标移到替换后位置

用户点击"全部替换"
  → onReplaceAll(replaceText) → handleReplaceAll()
    → 全文正则替换
```

**注意**：`replaceAll` 当前通过全文正则替换实现，会重置文档并丢失历史栈。改进方向：使用 CM6 的 `replaceNext` 命令逐个替换。

### 快捷键优先级

```
全局 window keydown listener
  └─ Ctrl+S, Ctrl+Shift+S, Ctrl+N, Ctrl+W, Ctrl+H, Ctrl+=/-, Ctrl+0, Alt+M/U
  
CM6 keymap（按注册顺序尝试）
  └─ defaultKeymap + historyKeymap（CM6 内置）
  └─ search() 的 searchKeymap（Ctrl+G=F3=findNext, Ctrl+Shift+G=findPrevious, Ctrl+D=selectNext）
  └─ 自定义 keymap（Ctrl+F 覆盖 searchKeymap 的 Ctrl+F=openSearchPanel）
```

**关键原则**：CM6 的 keymap 按注册顺序**逆序**匹配（后注册的优先级更高）。自定义 Ctrl+F 处理注册在 `search()` 之后，因此优先于 `search()` 的打开面板行为。全局监听只处理编辑器不处理的快捷键（保存、新建、缩放等），避免双重触发。

### Compartment 动态切换机制

CM6 的 `Compartment` 是唯一能在不重建 EditorView 的前提下增删扩展的机制：

```
初始化时：comp.current.of([ext1, ext2])
运行时：comp.current.reconfigure([ext3, ext4])  // 完全替换
```

**支持动态切换的扩展**：

| Compartment | 切换内容 | 切换方式 |
|-------------|---------|---------|
| `wordWrapComp` | `EditorView.lineWrapping` | Boolean toggle |
| `whitespaceComp` | `highlightSpecialChars()` | Boolean toggle |
| `columnModeComp` | `allowMultipleSelections` + CSS class | Boolean toggle |
| `readOnlyComp` | `EditorView.editable` | Boolean toggle |
| `zoomComp` | `fontSize` 主题 | Number slider |
| `langComp` | 语言扩展包 | 下拉选择 |

**注意事项**：
- `reconfigure` 是**替换**不是合并，旧扩展完全被新值取代
- 部分扩展（如 `rectangularSelection`）通过 Compartment 动态增删可能不生效，建议始终初始化时加入

---

## 本次 Fix 详细记录（2026-07-02）

### Bug 9：查找"下一个"光标不跳转

**现象**：在查找面板输入搜索词后，点击"下一个"/"上一个"，光标不移动到匹配位置。

**根因**：`EditorPanel.tsx` 的 `handleFindNext` 和 `handleFindPrev` 是空壳实现：

```typescript
// 旧代码 — 根本不是搜索，只是把光标移了 1 个字符
const handleFindNext = useCallback(() => {
  const view = editorViewRef.current;
  if (!view) return;
  const sel = view.state.selection.main;
  view.dispatch({ selection: { anchor: sel.to + 1 } });  // ← 光标+1
}, []);

const handleFindPrev = useCallback(() => {
  const view = editorViewRef.current;
  if (!view) return;
  const sel = view.state.selection.main;
  view.dispatch({ selection: { anchor: Math.max(0, sel.from - 1) } });  // ← 光标-1
}, []);
```

`handleFind` 虽然创建了 `SearchQuery`，但只用来统计匹配数，没有写入 CM6 的搜索状态。`findNext`/`findPrevious` 命令依赖 `searchState` 扩展提供的状态字段，但 `NddEditor.tsx` 的扩展列表中没有注册 `search()`。

**修复涉及的文件**：

| 文件 | 变更 |
|------|------|
| `NddEditor.tsx` | 添加 `search()` 到核心扩展列表（初始化 `searchState` 状态字段） |
| `EditorPanel.tsx` | 重写 `handleFind`/`handleFindNext`/`handleFindPrev`，使用 CM6 命令 |
| `EditorPanel.tsx` | 移除全局 Ctrl+F/G 拦截（避免与 CM6 keymap 双重触发导致跳两次） |

**修复后流程**：

```typescript
const handleFind = useCallback((query, options) => {
  const searchQuery = new SearchQuery({ search: query, ...options });
  view.dispatch({ effects: setSearchQuery.of(searchQuery) });  // 写入 CM6 状态
  // ... 统计匹配数 ...
  findNext(view);  // 跳转到第一个匹配
}, []);

const handleFindNext = () => findNext(view);   // CM6 原生搜索
const handleFindPrev = () => findPrevious(view); // CM6 原生搜索
```

**依赖关系**：`setSearchQuery` + `findNext`/`findPrevious` 来自 `@codemirror/search`，需要 `searchState` 状态字段存在（通过 `search()` 扩展注册）。

### Bug 10：列编辑模式不生效

**现象**：工具栏点击列模式按钮后，Alt+拖拽无法选择矩形文本块，无视觉反馈。

**根因**：三个问题叠加：
1. `rectangularSelection()` 和 `drawSelection()` 通过 Compartment 动态添加，CM6 对部分 DOM 相关扩展在初始化后增删支持不完整
2. 关闭列模式时，Compartment 写回 `[EditorView.contentAttributes.of({})]` 而不是 `[]`（一致性差）
3. 全局 keydown 监听器拦截 Ctrl+F/G，与 CM6 keymap 冲突可能导致事件处理异常

**Notepad++ 列模式 vs CM6 方案**：

| 特性 | Notepad++ | 本项目（CM6 方案） |
|------|-----------|-------------------|
| 触发方式 | 模式开关 + 鼠标拖拽 | Alt+拖拽（始终可用） |
| 列模式按钮 | 切换列编辑模式 | 切换视觉反馈 + 多重选择模式 |
| 光标样式 | 竖线 | 十字线（css） |
| 选中区渲染 | 特殊高亮 | 半透明矩形（drawSelection） |

**修复策略**：参考 VS Code 的做法 — Alt+拖拽始终可用，列模式按钮仅控制视觉提示。

**修复涉及的文件**：

| 文件 | 变更 |
|------|------|
| `NddEditor.tsx` | `rectangularSelection()` + `drawSelection()` 移入核心扩展（始终激活） |
| `NddEditor.tsx` | 列模式 Compartment 仅控制 `allowMultipleSelections` + CSS class |
| `NddEditor.tsx` | 列模式关闭时写回 `[EditorState.allowMultipleSelections.of(false)]` 而非 `[contentAttributes({})]` |
| `index.css` | 已有 `.cm-column-mode` 样式（十字光标 + 半透明选中区），未改动 |

**用户操作方式**：
- **直接 Alt+拖拽**：无需任何模式切换，随时可选矩形块（VS Code 风格）
- **切换列模式按钮**：开启十字光标视觉反馈 + 状态栏"列模式"指示，提醒正在列编辑状态

---

## 快速参考（下次直接查阅）

### Tailwind CSS 颜色 tokens

| Token | 值 | 用途 |
|-------|-----|------|
| `bg-deepest` | `#0a0a0b` | 最深层背景 / body |
| `bg-deep` | `#0f0f11` | 深层面板 |
| `bg-base` | `#161618` | 基础面板 / 输入框 |
| `bg-raised` | `#1c1c1f` | 弹窗 / 菜单 |
| `bg-hover` | `#252528` | 悬停态 |
| `text-primary` | `#f5f5f7` | 主文本 |
| `text-secondary` | `#98989e` | 次要文本 |
| `text-tertiary` | `#6e6e73` | 辅助文本 / 占位符 |
| `accent` | `#0a84ff` | 强调色 / 选中态 |
| `accent-hover` | `#409cff` | 强调色悬停 |
| `border-subtle` | `rgba(255,255,255,0.08)` | 分割线 / 边框 |
| `border-hover` | `rgba(255,255,255,0.14)` | 悬停边框 |

字体：`font-sans` → Segoe UI / SF Pro；`font-mono` → JetBrains Mono / Cascadia Code

### preload API (`window.electronAPI`)

```typescript
terminal: {
  create({ cwd, cols?, rows? }) => sessionId: string
  write(sessionId, data) => void
  resize(sessionId, cols, rows) => void
  kill(sessionId) => void
  onData(cb: (sessionId, data) => void) => unsubscribe: () => void
}
fs: {
  list(dirPath) => FileEntry[]
  read(filePath) => string
  readBinary(filePath) => string    // base64
  getFileInfo(filePath) => { size, modified, lineEnding }
  write(filePath, content) => void
  stat(filePath) => any
  createDir(parentPath, name) => void
  delete(targetPath) => void
  rename(oldPath, newPath) => void
  listDrives() => string[]
}
dialog: { openFolder() => string|null; saveFile() => string|null }
window: { minimize, maximize, close, isMaximized }
plantuml: { check() => status; render(content) => { success, svg?, error? } }
```

### Zustand stores API

| Store | 关键状态 | 关键方法 |
|-------|---------|---------|
| `useEditorStore` | `openFiles`, `activeFileId`, `showFindPanel`, `showReplacePanel`, `showHexView`, `readOnly`, `zoomLevel`, `cursorPosition`, `encoding`, `lineEnding`, `wordWrap`, `showWhitespace`, `columnMode` | `openFile`, `closeFile`, `setContent`, `markClean`, `createNewFile`, `saveAsFile`, `toggleFindPanel`, `toggleReplacePanel`, `toggleHexView`, `toggleWordWrap`, `toggleWhitespace`, `toggleColumnMode`, `setZoom`, `setCursorPosition`, `batchRestore` |
| `useFileStore` | `currentPath`, `entries`, `selectedPath`, `hiddenFiles` | `setCurrentPath`, `setEntries`, `setSelectedPath`, `toggleHiddenFiles` |
| `useProjectStore` | `projectPath`, `hasCompletedOnboarding` | `setProjectPath`, `completeOnboarding` |
| `useTerminalStore` | `sessions`, `activeSessionId` | `addSession`, `closeSession`, `setActiveSession`, `updateSession` |
| `useFavoritesStore` | `favorites: string[]` | `addFavorite`, `removeFavorite` |
| `useLayoutStore` | `leftWidth`, `centerWidth`, `rightWidth` | `setLeftWidth`, `setCenterWidth`, `setRightWidth`, `initWidths` |

### Plugin 系统

```
src/renderer/plugin-system/
├── plugin-types.ts    — PluginManifest, PluginInstance, PreviewRenderer 类型
├── plugin-api.ts      — PluginAPI 接口（editor/views/shortcuts/notification/http/platform）
├── plugin-store.ts    — Zustand store（installed/active/loading/error）
├── plugin-manager.ts  — initPluginSystem() 扫描并激活插件
└── built-in/
    ├── md-preview.ts          — Markdown 预览渲染器
    └── plantuml-preview.ts    — PlantUML 预览渲染器
```

插件通过 `PluginAPI` 暴露：editor 操作、快捷键注册、预览渲染器注册。内置插件在 `initPluginSystem()` 时自动激活。预览渲染器通过全局 Map 注册，`hasPreviewRenderer(language)` 检测。

### electron-builder.yml 关键配置

```yaml
appId: com.mlx.app
productName: MLX
win:
  target: [portable]   # x64 便携版
  sign: false
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
打包命令: npx electron-builder --win --dir
产物: release/win-unpacked/MLX.exe
```

### sessionManager 持久化

`services/sessionManager.ts` 使用 `electron-store` 键 `claude-forge-session` 持久化：
- `openFiles[]`, `activeFileId`, `cursorPosition`, `zoomLevel`, `wordWrap`
- `fileBrowserPath`, `layoutWidths`
- 触发时机：内容变更 3s 防抖 + `beforeunload` 事件

---

## 待改进项

---
## 排坑记录：打包产物过期导致修复不生效（2026-07-03）

**现象**：所有新功能（EverythingSearch、QuickTools、FileIndexer）和 Bug 修复在源码中已实现，但运行打包版后仍然缺失。

**根因**：`electron-builder` 在 00:09 运行，但源码修改在 00:19~00:38 之间完成。`dist-electron/` 和 `dist/` 于 00:38 通过 `vite build` 更新，但**没有重新打包**。`release/win-unpacked/resources/app.asar` 中：

| 功能 | 旧 asar | 新 asar |
|------|---------|---------|
| EverythingSearch | ❌ 0 matches | ✅ 5 matches |
| QuickTools | ❌ 0 matches | ✅ 包含（被 minify） |
| FileIndexer | ❌ 0 matches | ✅ 包含 |

**修复命令**（按顺序）：
```bash
npm run build                    # 先构建 dist-electron + dist
npx electron-builder --win --dir # 再打包到 release/win-unpacked
```

**教训**：
1. **打包版 Bug 排查第一件事：检查 asar 构建时间 vs 源码修改时间** — 如果 asar 早于源码，直接重新打包
2. **`npm run build` 必须紧接着 `electron-builder`** — 中间不能有其它操作
3. **Vite 使用内容哈希命名**（如 `index-DhbBVbA3.js`），asar 和 dist 中文件名不一致 = 内容不一致，是最快速的判断方法
4. **grep 直接查 asar 二进制不可靠**（asar 是压缩格式），应通过 `npx asar list` 确认文件列表后比较文件名哈希

### 修复 1：App.tsx 右分割线条件

**问题**：编辑器用 `AnimatePresence` 淡出退出（200ms），但右分割线 `PanelResizer` 用条件渲染立即消失，导致 flex 布局在 200ms 内多次重排，触发 XTerm 的 ResizeObserver 误报。

**修复**：右分割线条件从 `{(hasOpenFiles || showFileBrowser || showEverythingSearch)` 改为 `{(showFileBrowser || showEverythingSearch)`，不随编辑器状态变化。

**涉及文件**：`src/renderer/App.tsx:187`

### 修复 2：XTerm ResizeObserver 0 尺寸容错

**问题**：布局过渡期终端容器可能短暂为 0 尺寸，`fitAddon.fit()` 后 `terminal.cols` 或 `terminal.rows` 可能为 0，传给 `pty.resize(0, rows)` 可能导致 PTY 进程异常。

**修复**：resize 前检查 `terminal.cols > 0 && terminal.rows > 0`。

**涉及文件**：`src/renderer/components/terminal/XTerm.tsx:104`

### 修复 3：NddEditor 自动聚焦

**问题**：打开文件后编辑器不自动获取焦点，CM6 默认不聚焦编辑器，用户需要手动点击编辑器才能开始输入，造成"无法编辑"的错觉。

**修复**：在 CM6 EditorView 创建后调用 `view.focus()`。

**涉及文件**：`src/renderer/components/editor/NddEditor.tsx:154`

### 修复 4：EverythingSearch init() 异常处理

**问题**：搜索面板的 `init()` 异步函数缺少 try-catch，当 IPC `getStatus()` 调用抛出异常时，`indexLoading` 永远为 `true`，导致搜索输入框保持 `disabled` 状态无法输入。

**修复**：用 try-catch 包裹 IPC 调用，在 `finally` 块中将 `indexLoading` 置为 `false`，确保即使 IPC 失败输入框也可用（并在 UI 中显示重试按钮）。

**涉及文件**：`src/renderer/components/filesystem/EverythingSearch.tsx:62-93`

### 修复 5：QuickTools 靠右定位

**问题**：关闭所有面板后，QuickTools 作为 flex 子元素没有 `flex: 1` 的兄弟元素撑满剩余空间，导致其出现在屏幕中间而非最右侧。

**修复**：在 QuickTools 容器上添加 `ml-auto`（`margin-left: auto`），使其始终贴到 flex 容器右侧。

**涉及文件**：`src/renderer/components/layout/QuickTools.tsx:42`

---

## 附录：来自 Claude 记忆系统的补充记录

### html2pptx 校验规则速查

当创建 HTML 幻灯片用于 html2pptx 转换时，校验器强制以下规则（**非**标准 HTML/CSS 规则），违反会导致迭代重建循环：

1. **文本元素** (`<p>`, `<h1>`-`<h6>`, `<ul>`, `<ol>`) **不得使用**: `background`, `background-color`, `border`, `border-bottom`, `box-shadow`。这些仅适用于 `<div>`。如文本元素需要 border-bottom，用 `<div>` 包裹。
2. **文本元素不得以项目符号开头**（如 `◆`, `•`, `-`, `*`, `▎`）。改用 `<ul>`或 `<ol>`。
3. **`<span>` 不得使用 `margin`** — PowerPoint 文本运行不支持。改用父元素的 `padding`。
4. **所有文本必须在** `<p>`, `<h1>`-`<h6>`, `<ul>`, `<ol>` 标签内。`<div>` 或 `<span>` 中的文本被静默丢弃。
5. **不支持 CSS 渐变** — 用 Sharp 栅格化为 PNG 再引用。

**为什么**: 校验器增量报告错误（并非一次性），每条遗漏规则耗费一个完整构建周期。

### html2pptx Windows 路径 Bug 修复

`html2pptx.js` 在 Windows 上存在路径 Bug：浏览器将 `<img src="icon.png">` 解析为 `file:///D:/path/icon.png`，代码用 `.replace('file://', '')` 后得到 `/D:/path/icon.png`，Windows 上根斜杠导致 PptxGenJS 解析为 `D:\D:\path\icon.png`（双盘符）。

**修复**: 在 `C:\Users\31632\.claude\skills\pptx\scripts\html2pptx.js`（两处位置）添加：
```javascript
if (process.platform === 'win32' && /^\/[A-Z]:\//i.test(imagePath)) {
  imagePath = imagePath.slice(1);
}
```
如果 html2pptx.js 被更新，必须重新应用此修复。

### html2pptx 图片资源放置规范

所有图片资源（图标、箭头、渐变 PNG）直接放在 HTML 文件同级目录，**不用子文件夹**：

```
workspace/slides/
├── slide1.html
├── slide2.html
├── icon-target.png      # 与 HTML 同级
├── arrow-down.png
└── ...
```

**HTML 引用**: `<img src="icon-target.png">` — 裸文件名，无路径前缀。

**反模式**:
- `../assets/icon.png`（父路径）
- `assets/icon.png`（子文件夹）
- `D:/absolute/path/icon.png`（绝对路径）

### CodeMirror 6 关键设计原则

1. **`search()` 扩展必须在初始化时加入编辑器** — `findNext`/`findPrevious` 依赖 `searchState` 状态字段，该字段只能通过 `search()` 扩展在初始化时注册。动态添加无效。

2. **查找操作通过 `editorViewRef` 直调 CM6 API，不走 React 渲染** — 搜索性能和实时性要求高，避免 React 状态更新带来的额外渲染。`setSearchQuery` 效果直接写入 CM6 state，`findNext`/`findPrevious` 直接操作 view。

3. **`rectangularSelection()` + `drawSelection()` 应从初始化时加入核心扩展** — Compartment 动态增删此类 DOM 交互扩展可能不生效。最佳实践是始终激活 Alt+拖拽矩形选择（VS Code 方式），用 CSS class + 状态栏指示器作为模式切换的视觉反馈。

4. **CM6 keymap 优先级 = 注册顺序的逆序** — 后注册的 keymap 优先级更高。自定义 Ctrl+F 处理必须注册在 `search()` 之后，才能覆盖其 `openSearchPanel` 行为。

5. **全局 keydown 监听只处理与编辑器无关的快捷键** — 编辑器相关的快捷键（Ctrl+F/G/D）由 CM6 keymap 处理。全局监听和后注册 keymap 同时处理同一快捷键会导致双重触发。全局监听适合：保存（Ctrl+S）、新建（Ctrl+N）、缩放（Ctrl+=/-）、标签操作（Ctrl+W）。

### ClaudeForge 关键设计原则（补充）

以下 4 条规则从反复修复的 Bug 中提炼，违反任何一条都会导致已修复问题重现：

1. **禁止在 flex 常驻面板上使用 Framer Motion `layout` 动画** — `<motion.div layout>` 的 FLIP 动画会覆盖 flex 布局的高度/宽度传递。正确做法：常驻面板用普通 `<div>` + flex；编辑器用 `AnimatePresence` + opacity-only 动画。

2. **文件类型检测用黑名单 + 二进制检测** — 白名单永远无法覆盖所有文本格式。策略：定义 ~60 种二进制扩展名黑名单 → 不在黑名单则尝试 utf-8 读取 → 检测前 512 字节是否有 `\x00`（null 字节）。

3. **Monaco Editor 切换文件需要 `key={fileId}`** — `<Editor>` 在 `value` prop 变化时可能不更新底层模型，`key={fileId}` 确保创建新编辑器实例。

4. **Zustand store 中 `setCurrentPath` 不触发数据加载** — 只更新状态不调用 `loadDir`。数据加载逻辑在 `FileTree` 的 `useEffect` 中监听 `rootPath` 变化触发。确保 useEffect 没有额外的守卫条件。

---

## 本次 Fix 详细记录（2026-07-03）

### Bug 11-12：终端页签改名相关问题

**Bug 11：双击改名后需按回车才生效** — 用户期望点击任意处自动提交。

**根因**：`TerminalTabs.tsx` 的输入框已有 `onBlur={commitEdit}`，但点击页签容器空白区域时焦点未正确触发 blur。

**修复**：在页签容器 `div` 上添加 `onClick={handleContainerClick}`，点击容器任意位置自动提交编辑。

**Bug 12：改名后终端无法输入命令**

**根因**：编辑完成后焦点留在已销毁的 input 元素上，xterm 未重新获得焦点。

**修复**：
- `XTerm.tsx` 改为 `forwardRef` + `useImperativeHandle` 暴露 `focus()` 方法
- `TerminalTabs.tsx` 新增 `onEditCommitted` 回调
- `TerminalPanel.tsx` 在重命名完成后自动调用 `xtermRef.current?.focus()`

**涉及文件**：`TerminalTabs.tsx`、`XTerm.tsx`、`TerminalPanel.tsx`

---

### 功能 7：顶部菜单栏

**描述**：在标题栏上方新增传统菜单栏（文件/编辑/视图/帮助）。

**实现**：
- `AppShell.tsx` 新增菜单栏区域，位于标题栏上方
- 四个菜单组：文件（新建/打开/关闭）、编辑（查找/替换/列模式/换行）、视图（切文件浏览器/文件搜索/新建终端）、帮助（关于）
- 菜单使用悬停快速切换 + 点击外部自动关闭
- 菜单栏保留 `titlebar-drag` 类，不影响窗口拖拽

**涉及文件**：`AppShell.tsx`

---

### 功能 8：Ctrl+Shift+P 切换工作空间

**描述**：右下角状态栏一直显示 "Ctrl+Shift+P 切换项目" 但从未实现。

**修复**：
- 在 `App.tsx` 的全局 `keydown` 监听中新增 `Ctrl+Shift+P` → 调用 `dialog.openFolder()` 选择新项目目录
- 状态栏文字添加 `onClick` 触发相同逻辑
- 切换时关闭所有打开的编辑器标签，避免残留

**涉及文件**：`App.tsx`、`AppShell.tsx`

---

### 功能 9：右侧快捷工具栏

**描述**：文件浏览器等工具关闭后无法重新打开。

**实现**：
- 新增 `QuickTools.tsx` — 右侧边缘窄工具栏（约 40px）
- 自动检测当前隐藏的工具，只显示对应快捷按钮
- 点击按钮重新打开对应工具面板
- 当所有工具都可见时自动隐藏

**涉及文件**：`QuickTools.tsx`、`useLayoutStore.ts`、`App.tsx`

---

### 功能 10：自建文件搜索引擎（对标 Everything）

**这是本次最大的改动**，完全自建一套全盘文件搜索引擎，能力对标 Everything。

#### 架构：内存索引 + 后台扫描 + v8 持久化

```
FileIndexer（主进程）
  ├── nameIndex: Map<小写文件名, IndexedEntry[]>  → O(1) 查找
  ├── pathIndex: Map<完整路径, IndexedEntry>       → 路径反查
  ├── 启动时：v8.deserialize 加载缓存 → 秒级就绪
  ├── 无缓存时：全盘扫描 → 后台 30-60s
  ├── 运行时：chokidar 监听用户目录 → 实时增量更新
  └── 关闭时：v8.serialize → 持久化到 userData
```

#### 搜索性能

| 阶段 | 耗时 | 说明 |
|------|------|------|
| **首次扫描** | 30-60s | 后台运行，不阻塞 UI，显示进度条 |
| **二次启动** | **1-3s** | 从磁盘反序列化上次索引，秒级恢复 |
| **搜索查询** | 1-50ms | Map 中前缀/子串匹配，不碰磁盘 |
| **增量更新** | 实时 | chokidar 监听 create/delete/rename |

#### 磁盘寿命影响（零风险）

1. **首次扫描**：一次全盘读取（不写盘），现代 SSD 可承受成千上万次
2. **chokidar 监听**：使用 Windows `ReadDirectoryChangesW` API，**事件驱动，不轮询**，零磁盘 I/O
3. **索引持久化**：约 50MB 一次性写入，之后仅增量写入

#### 排序策略

搜索结果按匹配质量排序：**精确匹配 → 前缀匹配 → 子串匹配**，同级按修改时间倒序。

#### 关键词：精确匹配

```
search(query):
  lower = query.toLowerCase()
  for each (name, entries) in nameIndex:
    if name.includes(lower):
      score = 0(精确) | 1(前缀) | 2(子串)
      add to results with score + mtime
  sort by score asc, mtime desc
  return top 500
```

#### 搜索 UI

- **结果行**：文件类型图标（按扩展名着色，如 .pdf 红色、.zip 橙色）、文件名、完整路径、文件大小、修改日期
- **键盘导航**：↑↓ 移动选中行，Enter 打开，Esc 清空
- **双击打开**：调用 `shell.openPath()` → 系统默认程序打开（如 .pdf 用 Edge、.png 用照片查看器）
- **索引状态栏**：显示就绪/扫描中/已索引文件数
- **跨会话**：索引持久化到磁盘，下次启动秒级加载

#### 关键设计决策

1. **为什么不用 Everything 的 es.exe？** — 用户要求完全自建，不依赖外部工具。
2. **为什么不用 JSON 序列化？** — `v8.serialize` 是二进制格式，比 JSON 快 3-5 倍，且天然支持 Map。
3. **为什么不用 SQLite？** — 不需要复杂查询，Map 的 O(1) 查找已足够，避免原生模块编译问题。
4. **索引存储位置**：`app.getPath('userData')/mlx-file-index.dat`
5. **chokidar 只监听用户目录**（Desktop/Documents/Downloads/项目目录），不监听系统驱动器根目录，避免文件句柄溢出。

#### 新增/修改文件

| 文件 | 说明 |
|------|------|
| `src/main/services/file-indexer.ts` | 核心索引引擎：扫描、搜索、持久化、监听 |
| `src/main/ipc/file-indexer.ipc.ts` | IPC handler + `shell.openPath()` 系统打开 |
| `src/shared/types.ts` | SearchResult 增加 size/modified，新增 IndexStatus |
| `src/shared/ipc-channels.ts` | 新增 FILE_INDEXER_* 和 FS_OPEN_FILE 通道 |
| `src/main/main.ts` | 注册 indexer IPC + 启动索引 + 关闭前保存 |
| `src/preload/preload.ts` | 暴露 fileIndexer API |
| `src/renderer/types/electron.d.ts` | 添加 fileIndexer 类型声明 |
| `src/renderer/components/filesystem/EverythingSearch.tsx` | 搜索 UI 全面重写 |
| `src/main/ipc/filesystem.ipc.ts` | 移除旧的递归搜索代码 |

---

## 已修复的 Bug 清单更新

| # | 日期 | 问题 | 根因 | 修复方式 |
|---|------|------|------|---------|
| 11 | 2026-07-03 | 终端改名需按回车才生效 | 容器点击未触发 blur | 容器 div 添加 onClick 自动提交 |
| 12 | 2026-07-03 | 改名后终端无法输入 | 焦点未返回 xterm | forwardRef + useImperativeHandle 暴露 focus 方法 |

---

## 快速参考更新

### FileIndexer API

```typescript
// 主进程 (file-indexer.ts)
class FileIndexer {
  async start(): Promise<void>
  search(query: string, maxResults?: number): SearchResult[]
  getStatus(): { isReady, isScanning, indexedCount }
  async reindex(): Promise<void>
  stop(): void
  onProgress(cb): void
  onReady(cb): void
  onError(cb): void
}

// Preload API (window.electronAPI.fileIndexer)
fileIndexer: {
  search(query): SearchResult[]
  getStatus(): IndexStatus
  start(): void
  reindex(): void
  onProgress(cb): unsubscribe
  onReady(cb): unsubscribe
}
```

### IPC 通道速查（新增部分）

| 通道 | 方向 | 参数 | 返回值 |
|------|------|------|--------|
| `file-indexer:search` | 渲染→主 | `(query)` | `SearchResult[]` |
| `file-indexer:status` | 渲染→主 | `()` | `IndexStatus` |
| `file-indexer:start` | 渲染→主 | `()` | `void` |
| `file-indexer:reindex` | 渲染→主 | `()` | `void` |
| `file-indexer:progress` | 主→渲染 | `event` | `{indexed, estimatedTotal}` |
| `file-indexer:ready` | 主→渲染 | `event` | `void` |
| `fs:open-file` | 渲染→主 | `(filePath)` | `void` (shell.openPath) |

---

## 三轮大规模Bug修复与功能增强（2026-07-03）

### 第一轮：11项基础修复（10:00-10:40）

用户反馈了10个核心bug和需求，加上1个新发现的bug，合计11项。

#### 项目架构理解

经过对 `MLX工具开发日志.md` 全部833行的深度阅读，以及对 `claudeforge/` 项目源码的全面分析，建立以下核心认知：

**技术栈速查：**
- Electron 43 (主进程) + React 19 + TypeScript + Vite 6 (渲染进程)
- xterm.js + @lydell/node-pty (终端PTY嵌入，支持PowerShell/Claude CLI)
- CodeMirror 6 (代码编辑器，替代Monaco Editor，~300KB vs ~20MB)
- Zustand 5 (轻量状态管理，无Provider包裹)
- Framer Motion 12 (动效)
- Tailwind CSS 3 + CSS自定义属性 (暗黑玻璃拟态)
- electron-builder 25 (NSIS/便携式Windows打包)

**布局系统核心理解：**
```
AppShell (flex-col: 标题栏 → 菜单栏 → 内容区 → 状态栏)
  └─ App.tsx (flex-row: 终端 | 编辑器 | 文件浏览器 | 文件搜索 | QuickTools)
       ├─ TerminalPanel → XTerm (xterm.js + PTY session)
       ├─ PanelResizer (6px可拖拽分割线，PointerEvent + setPointerCapture)
       ├─ EditorPanel → NddEditor (CodeMirror 6)
       ├─ FileBrowser → FileTree (右键菜单、文件操作)
       ├─ EverythingSearch (自建全盘文件搜索引擎)
       └─ QuickTools (右侧快捷工具栏)
```

**组件通信方式：**
- 父→子：React Props
- 子→父：回调Props (如 `onEditorViewReady` 暴露 EditorView 引用)
- 跨组件：Zustand Store (5个store分管不同领域)
- 主↔渲染：IPC (contextBridge + ipcRenderer.invoke / ipcMain.handle)
- CM6编辑器操作：`editorViewRef.current` 直接调用CM6 API，不走React渲染周期
- 终端PTY：主进程 `terminal-manager.ts` 管理node-pty进程，IPC转发数据

**关键设计原则（从反复Bug中提炼）：**
1. 终端常驻App级别，不随layout切换销毁（否则PTY session丢失）
2. Framer Motion layout动画不能用于flex常驻面板（FLIP动画破坏flex尺寸传递）
3. CM6 `search()` 扩展必须在初始化时加入（`searchState`字段依赖）
4. CM6 keymap优先级=注册顺序的逆序（后注册的覆盖先注册）
5. 文件类型检测用黑名单+null字节检测（白名单无法覆盖所有文本格式）

#### 实施清单

**Bug #1: 终端关闭其他面板后不自动全屏**
- App.tsx 终端容器：expanded时用 `flex: 1` 替代固定 `leftWidth`

**Feature #2: 文件管理器新建文件支持类型选择**
- 新建 `NewFileTypePicker.tsx`：18种常见文件格式(.txt/.md/.js/.ts/.json/.html/.css/.py/.java/.c/.cpp/.xml/.yaml/.sql/.sh/.bat/.ini/.log)
- `FileTree.tsx`：类型选择→创建→进入行内重命名模式
- `FileRow.tsx`：新增 `editing` prop，行内 `<input>` 替代 `<span>`，Enter/Esc/blur提交

**Feature #3: 文件搜索右键菜单**
- `EverythingSearch.tsx`：ContextMenu with "打开文件所在文件夹"(shell.showItemInFolder)、"复制文件路径"、"复制"/"剪切"/"粘贴"
- 新建 `useFileClipboardStore.ts`：追踪文件复制/剪切路径和操作类型

**Feature #4: 文件浏览器右键增强 + 系统默认程序打开**
- `FileTree.tsx`：context menu新增"打开所在文件夹"、"复制"、"剪切"、"粘贴"
- 二进制文件：双击→`shell.openPath()` 系统默认程序打开（不再报错）
- 搜索结果：始终用系统默认程序打开（不在编辑器预览）

**Feature #5: 主题系统（第一版）**
- 新建 `useThemeStore.ts`：4套主题(dark/light/blue/high-contrast) + localStorage持久化
- `index.css`：4套CSS变量定义
- `AppShell.tsx`：菜单栏追加"主题"按钮

**Feature #6: 标题/Slogan布局重构**
- AppShell：第1行=MLX + "Make! Learn! Extraordinary!" + 窗口控制按钮
- 第2行=菜单栏，第3行+ =工具面板

**Feature #7: 菜单栏完整交互**
- 文件菜单：新建(Ctrl+N)、打开(Ctrl+O)、保存(Ctrl+S)、另存为(Ctrl+Shift+S)、关闭(Ctrl+W)、关闭所有
- 编辑菜单：撤销(Ctrl+Z)、重做(Ctrl+Y) → 需要访问CM6 EditorView
- 视图菜单：三列排版(5:3:2)、三列一横(搜索在底部)、自由排版
- `useEditorStore` 新增 `editorView` 字段供菜单调用undo/redo命令
- `EditorPanel.tsx` 的 `handleEditorViewReady` 中调用 `setEditorView(view)`
- 新建 `dialog.openFile` IPC通道

**Bug #8: 文件浏览器右边框无法拖拽**
- `useLayoutStore` 新增 `browserWidth` 字段
- App.tsx：文件浏览器使用固定 `browserWidth` + 右侧PanelResizer

**Bug #9: 文件搜索关闭按钮验证**
- EverythingSearch关闭按钮已存在，增强样式为hover红色高亮

**Feature #10: QuickTools支持所有面板**
- `useLayoutStore` 新增 `showTerminal`、`showEditor` 字段
- QuickTools新增终端/编辑器按钮

**Bug #11: 拖动终端边框后终端失去焦点**
- **根因**：PanelResizer使用 `setPointerCapture` 捕获指针事件，释放后xterm.js隐藏textarea未自动恢复焦点
- **修复**：
  - `useTerminalStore` 新增 `focusActiveTerminal` 函数 + `setFocusFn`
  - `XTerm.tsx` 挂载时注册 `focusFn`，卸载时清除
  - `PanelResizer` 新增 `onDragEnd` 回调
  - `App.tsx` 终端↔编辑器resizer拖拽结束后调用 `focusActiveTerminal?.()`

#### 第一轮打包踩坑
- `PanelResizer.tsx` 中 `isHorizontal` 变量声明在 `useCallback` 之后，导致 `TS2448: Block-scoped variable used before declaration`
- 修复：将 `const isHorizontal = direction === 'horizontal'` 移到所有 `useCallback` 之前

---

### 第二轮：主题+面板+工具联动（11:00-11:05）

用户测试第一轮后反馈4个问题：

#### Issue 1: 面板缺少关闭按钮
- TerminalPanel标题栏+EditorPanel标题栏各增加X关闭按钮
- 关闭调用 `setShowTerminal(false)` / `setShowEditor(false)`

#### Issue 2: QuickTools非全屏时被挤出
- **根因**：`ml-auto` 在flex容器中，面板总宽度超出窗口时被推出视图
- **修复**：QuickTools改为 `flex-shrink: 0` 确保始终占用空间

#### Issue 3: 主题系统全面重设计

**核心问题：终端背景色硬编码不跟随主题**

`XTerm.tsx` 中 `TERMINAL_THEME` 是模块级常量，创建 Terminal 实例时传入后不再改变。

**修复方案：**
1. 重写 `getTerminalTheme(themeId)` 函数，4套主题对应4套完整终端配色
2. Terminal创建时从 `useThemeStore.getState().current` 读取当前主题
3. `useThemeStore.subscribe()` 监听主题变化，实时调用 `terminal.options.theme = newTheme`
4. Electron窗口 `backgroundColor` 通过IPC `WINDOW_SET_BG` 同步

**4套主题配色（参考流行IDE主题）：**
- **暗黑** — Tokyo Night：深藏蓝底 `#1a1b26`，柔和蓝白文字 `#c0caf5`，蓝色accent `#7aa2f7`
- **白黑** — GitHub Light：纯白底 `#ffffff`，极黑文字 `#1F2328`，深蓝accent `#0969da`（对比度15:1，超WCAG AAA）
- **蓝白** — One Light：浅灰蓝底 `#fafafa`，黑蓝文字 `#2A2C33`，Atom蓝accent `#0098DD`
- **高对比科技感** — SynthWave '84：近黑紫底 `#0D0F1C`，霓虹青accent `#00F0FF`，终端绿字

**主题研究来源：** GitHub Primer Design System、Tokyo Night by enkia、Bluloco Light by uloco、SynthWave '84 by Robb Owen

#### Issue 4: 视图→"工具显示"子菜单 + CSS面板隐藏

**架构变更：面板从条件渲染改为CSS `display:none` 隐藏**

```tsx
// 旧：条件渲染 → 销毁组件 → 丢失状态
{showTerminal && <TerminalPanel />}

// 新：CSS隐藏 → 保留组件 → 保留PTY session/编辑器内容
<div style={{ display: showTerminal ? undefined : 'none', ... }}>
  <TerminalPanel />
</div>
```

**"工具显示"子菜单实现：**
- `MenuItem` 接口新增 `submenu?: MenuItem[]`
- 子菜单通过 `onMouseEnter` 展开，点击checkbox不关闭菜单（实时联动）
- checkbox checked状态每次都从 `useLayoutStore.getState()` 动态读取
- 4个全选→等宽4列；全不选→QuickTools显示全部按钮

---

### 第三轮：自定义主题系统 + 细节打磨（11:15-11:25）

#### 用户反馈：
1. 删除蓝白主题（3个内置主题足够）
2. 主题需覆盖所有UI元素（glass-panel阴影之前硬编码 `rgba(0,0,0,0.4)`）
3. QuickTools需绝对定位固定（不受面板拖拽影响）
4. 白黑主题文字不够黑
5. 高对比度主题改为深蓝底色
6. 自定义主题系统（核心功能）

#### useThemeStore 完全重写

**架构设计：**

```
主题数据模型：
├─ 内置主题 (BuiltInThemeId: 'dark' | 'light' | 'high-contrast')
│   └─ BUILT_IN_THEMES: Record<BuiltInThemeId, ThemeColors>
│       └─ 20个颜色字段 + 3个终端颜色字段
│
├─ 自定义主题 (CustomTheme)
│   ├─ id: string (custom-{timestamp})
│   ├─ name: string (用户命名)
│   ├─ colors: ThemeColors
│   └─ fontSize: { ui, editor, terminal }
│
└─ 持久化: localStorage (customThemes → JSON)
```

**主题应用逻辑：**
```
applyTheme(themeId, customThemes):
  if themeId in BUILT_IN:
    document.documentElement.dataset.theme = themeId  → CSS选择器生效
  else:
    document.documentElement.dataset.theme = ''       → 清除CSS选择器
    for each color in customTheme.colors:
      document.documentElement.style.setProperty(varName, value)  → JS动态注入
```

**关键函数：**
- `previewColors(colors)` — 实时预览：直接调用 `applyColors()` 修改CSS变量，不持久化
- `getCurrentColors()` — 获取当前主题完整配色（内置从常量查，自定义从store查）
- `addCustomTheme/updateCustomTheme/deleteCustomTheme` — CRUD操作+localStorage同步

#### ThemeManager 组件设计

**布局：** 左侧主题列表(200px) + 右侧颜色编辑器(600px)，总宽800px

**左侧面板：**
- 内置主题列表（暗黑/白黑/高对比度）— 只读，选中预览
- 自定义主题列表 — 可选中编辑/删除
- 底部工具栏：新建按钮 / 关闭按钮

**右侧面板：**
- 颜色编辑器：6个分组（背景/文字/强调/边框/面板/终端），19个颜色字段
- 每个字段：`<input type="color">` + 文本输入框，修改即实时预览
- 字体大小滑块：界面字体(11-16px)、编辑器字体(10-24px)、终端字体(10-20px)
- 保存按钮（仅自定义主题显示）

**实时预览机制：**
```
用户拖动颜色选择器
  → handleColorChange(key, value)
    → setEditingColors({...editingColors, [key]: value})
    → previewColors(newColors)
      → document.documentElement.style.setProperty('--xxx', value)
      → 整个界面即时变色（包括所有面板、终端、滚动条）
```

#### CSS主题变量完善

**问题：** `.glass-panel` 的 `box-shadow` 之前硬编码为 `rgba(0,0,0,0.4)`，在亮色主题下显示为不协调的黑色阴影。

**修复：** 新增CSS变量 `--glass-shadow`，每个主题独立定义：
- 暗黑：`0 4px 24px rgba(0,0,0,0.5)` — 深阴影增强层次感
- 白黑：`0 2px 12px rgba(0,0,0,0.08)` — 浅阴影保持干净
- 高对比度：`0 4px 24px rgba(0,0,0,0.6)` + 青色内发光

#### QuickTools 绝对定位

**问题：** QuickTools 在flex布局中作为最后一个子元素，当左侧面板宽度调整时会左右移动。

**修复：**
- QuickTools: `position: absolute; right: 8px; top: 50%; transform: translateY(-50%); z-index: 20`
- App.tsx 内容容器: `position: relative`
- 去掉 `ml-auto` / `flex-shrink-0` wrapper

---

## 项目理解总结

### 文件依赖关系图

```
useThemeStore.ts ←─ XTerm.tsx (终端配色)
    ↓              ←─ ThemeManager.tsx (主题编辑器)
AppShell.tsx       ←─ index.css (CSS变量)
    ↓
App.tsx ←─ useLayoutStore.ts ←─ QuickTools.tsx
    ↓         ↓                    ↓
TerminalPanel  EditorPanel    FileBrowser
    ↓              ↓               ↓
XTerm.tsx    NddEditor.tsx    FileTree.tsx
                               ↓
                          FileRow.tsx
                          NewFileTypePicker.tsx
                          ContextMenu.tsx

EverythingSearch.tsx ←─ useFileClipboardStore.ts
                         ↓
                    filesystem.ipc.ts (shell.showItemInFolder)
                    dialog.ipc.ts (openFile dialog)
```

### Zustand Store 职责划分

| Store | 职责 | 关键字段 |
|-------|------|---------|
| `useThemeStore` | 主题管理 | current, customThemes, previewColors, getCurrentColors |
| `useLayoutStore` | 面板布局 | leftWidth, centerWidth, browserWidth, showTerminal/Editor/FileBrowser/Search, layoutMode |
| `useEditorStore` | 编辑器状态 | openFiles, activeFileId, editorView (供菜单撤销/重做) |
| `useTerminalStore` | 终端管理 | tabs, activeId, focusActiveTerminal (供拖拽后恢复焦点) |
| `useFileStore` | 文件浏览 | currentPath, entries, selectedPath |
| `useFileClipboardStore` | 文件剪贴板 | paths, operation (copy/cut) |

### CSS变量体系（19个变量）

**背景色：** --bg-deepest → --bg-deep → --bg-base → --bg-raised → --bg-hover
**文字色：** --text-primary → --text-secondary → --text-tertiary
**强调色：** --accent → --accent-hover
**边框色：** --border-subtle → --border-hover
**面板：** --glass-bg, --glass-blur, --glass-shadow
**滚动条：** --scrollbar-thumb, --scrollbar-thumb-hover
**窗口：** --window-bg
**终端（JS动态）：** terminalBg, terminalFg, terminalCursor

### IPC通道速查（最新）

| 通道 | 方向 | 用途 |
|------|------|------|
| `fs:show-in-folder` | 渲染→主 | shell.showItemInFolder |
| `fs:copy-file` | 渲染→主 | fs.promises.copyFile |
| `dialog:open-file` | 渲染→主 | dialog.showOpenDialog (单选文件) |
| `window:set-bg` | 渲染→主 | mainWindow.setBackgroundColor |
| `file-indexer:search` | 渲染→主 | 全盘文件搜索 |
| `fs:open-file` | 渲染→主 | shell.openPath (系统默认程序打开) |

### 教训与经验

1. **xterm.js的Terminal实例不能动态切换主题** — 只能通过 `terminal.options.theme = newTheme` 对象替换
2. **Zustand subscribe 是监听主题变化的首选方式** — 不需要React Context或useEffect依赖
3. **CSS display:none vs 条件渲染** — 隐藏面板保留状态用display:none，销毁用条件渲染
4. **绝对定位 vs Flex子元素** — 需要固定位置的UI（如QuickTools）用absolute脱离flex流
5. **CSS变量 + JS动态setProperty** — 内置主题用CSS选择器，自定义主题用JS注入，两者互补
6. **localStorage JSON序列化** — 自定义主题数据量小(<5KB)，无需electron-store
7. **打包前必须 `tsc && vite build` 再 `electron-builder`** — 顺序不能错，否则asar包含旧代码
8. **TypeScript变量声明顺序** — const必须在useCallback之前声明，否则编译错误

---

## 第四轮Bug修复：主题全覆盖 + 终端焦点 + 面板拖拽（2026-07-03 12:00）

用户反馈第二轮和第三轮修改后仍有3个核心bug，且态度明确要求彻底解决。

### Bug 1: QuickTools 太宽

**修改：** 按钮从 `w-8 h-8` 缩至 `w-7 h-7`(28px)，容器padding从 `py-2 px-1` 缩至 `py-1.5 px-0.5`，图标从18px缩至16px，去掉多余border。

### Bug 2: 终端在任何情况下都能输入（永久修复）

**根因分析：**
- CSS `display:none` 隐藏面板时 xterm.js 实例仍存活但canvas可能不渲染
- PanelResizer拖拽后 `setPointerCapture` 偷走焦点
- 从QuickTools恢复面板后无自动聚焦机制
- 切换布局/标签页后焦点丢失

**修复：**
- `TerminalPanel.tsx`：新增 `useEffect` 监听 `showTerminal`，面板从隐藏→可见时 `setTimeout + requestAnimationFrame` 双重延迟后调用 `xtermRef.current?.focus()`
- `XTerm.tsx`：`onClick` 改为 `onMouseDown`，在xterm捕获事件前用 `setTimeout(0)` 提前聚焦
- `PanelResizer.onDragEnd`：拖拽结束后调用 `focusActiveTerminal?.()`（已有）

### Bug 3: 主题全局生效（所有控件变色）

**根因发现：**
1. **`tailwind.config.js` 颜色全部硬编码！** 所有 `bg-bg-deep`、`text-text-primary` 等Tailwind class用的是静态hex值如 `#0f0f11`，从不引用CSS变量。这是最致命的bug——切换 `[data-theme]` 时CSS变量变了，但Tailwind生成的class从未使用这些变量。
2. **CodeMirrorTheme.ts 200+行硬编码暗黑配色**，编辑器永远不变色。
3. **`.glass-panel` 的 `box-shadow` 硬编码** `rgba(0,0,0,0.4)`。

**修复：**
- `tailwind.config.js`：全部颜色改为 `var(--xxx)` 引用 → Tailwind生成 `background-color: var(--bg-deep)` 而非 `background-color: #0f0f11`
- `CodeMirrorTheme.ts`：完全重写为 `createEditorTheme(colors: ThemeColors)` 函数，根据当前主题配色动态生成CM6 EditorView.theme + syntaxHighlighting
- `NddEditor.tsx`：新增 `themeComp` Compartment + `useThemeStore.subscribe()` 监听，主题变化时 `reconfigure` 编辑器
- `index.css`：`--glass-shadow` CSS变量替代硬编码box-shadow

**结果：** 切换主题后标题栏、菜单栏、状态栏、面板、编辑器（含行号/光标/选中/搜索高亮/自动补全）、终端、滚动条全部同步变色。

### Bug 4: 面板拖拽比例调节修复

**问题1：** 终端右侧分割线条件 `showTerminal && showEditorPanel` — 编辑器隐藏时分割线不渲染，终端和文件浏览器之间无法拖拽。

**修复：** 条件改为 `showTerminal && (showEditorPanel || showFileBrowser || showEverythingSearch)` — 只要右边有任何面板就显示分割线。

**问题2：** `allFourVisible` 时使用百分比宽度 `${100/visibleCount}%`，像素值 `leftWidth` 被忽略，拖拽无效。

**修复：** 完全移除百分比宽度逻辑，始终使用 store 中的像素值。

**问题3：** 文件浏览器宽度在有无搜索时策略不对。

**修复：** 右侧有搜索→固定 `browserWidth` + 分割线；右侧无搜索→`flex:1` 自动填满。

### 新增：可见面板数变化时自动等分宽度

```typescript
useEffect(() => {
  const visiblePanels = [...].filter(Boolean).length;
  const equal = Math.round((window.innerWidth - 16) / visiblePanels);
  // 1个→占满  2个→各50%  3个+→各等宽
  // 分别setLeftWidth/setCenterWidth/setBrowserWidth
}, [visiblePanels, showTerminal, showEditorPanel, showFileBrowser, showEverythingSearch]);
```

---

## GitHub 项目文档（2026-07-03）

为发布到GitHub创建的标准文档：

| 文件 | 用途 |
|------|------|
| `README.md` | 中文项目主页（功能、截图架构图、快速开始、技术栈、快捷键） |
| `README_EN.md` | 英文版 |
| `LICENSE` | MIT许可证 |
| `CONTRIBUTING.md` | 贡献指南（Bug报告、PR流程、代码规范、提交约定） |
| `.github/ISSUE_TEMPLATE/bug_report.md` | Bug报告模板 |
| `.github/ISSUE_TEMPLATE/feature_request.md` | 功能请求模板 |
| `.gitignore` | 更新覆盖node_modules/dist/release/IDE/OS/环境变量 |

---

## 最终修改文件总览

经历4轮迭代，共修改/新建以下文件：

### 新建文件 (8个)
```
src/renderer/stores/useThemeStore.ts          — 主题管理（内置+自定义+CRUD+预览）
src/renderer/stores/useFileClipboardStore.ts   — 文件剪贴板（复制/剪切追踪）
src/renderer/components/filesystem/NewFileTypePicker.tsx — 新建文件类型选择器
src/renderer/components/theme/ThemeManager.tsx — 主题管理器弹窗
README.md / README_EN.md / LICENSE / CONTRIBUTING.md — GitHub文档
```

### 修改文件 (17个)
```
src/renderer/App.tsx                           — 布局核心：面板显隐、分割线、等宽、CSS隐藏
src/renderer/components/layout/AppShell.tsx     — 菜单栏完整功能+主题菜单+工具显示子菜单+标题栏
src/renderer/stores/useLayoutStore.ts           — 布局状态（showTerminal/Editor/FileBrowser/Search, browserWidth等）
src/renderer/stores/useEditorStore.ts           — 编辑器状态（editorView引用供菜单undo/redo）
src/renderer/stores/useTerminalStore.ts         — 终端状态（focusActiveTerminal函数）
src/renderer/components/terminal/XTerm.tsx      — 动态终端配色+focus注册
src/renderer/components/terminal/TerminalPanel.tsx — 关闭按钮+visibility变化refocus
src/renderer/components/editor/EditorPanel.tsx  — 面板关闭按钮+setEditorView
src/renderer/components/editor/NddEditor.tsx    — 动态编辑器主题Compartment
src/renderer/components/editor/CodeMirrorTheme.ts — 完全重写为createEditorTheme函数
src/renderer/components/layout/PanelResizer.tsx — onDragEnd回调+垂直方向支持
src/renderer/components/layout/QuickTools.tsx   — 绝对定位+窄按钮
src/renderer/components/filesystem/FileTree.tsx — 右键菜单增强+行内重命名+文件类型选择+系统打开
src/renderer/components/filesystem/FileRow.tsx  — 行内重命名模式
src/renderer/components/filesystem/EverythingSearch.tsx — 右键菜单+关闭按钮增强
src/renderer/styles/index.css                   — 3套内置主题+glass-shadow+滚动条变量
tailwind.config.js                              — 全部颜色改为CSS变量引用
src/shared/ipc-channels.ts                      — 新增FS_SHOW_IN_FOLDER/FS_COPY_FILE/DIALOG_OPEN_FILE/WINDOW_SET_BG
src/main/ipc/filesystem.ipc.ts                  — showItemInFolder/copyFile处理器
src/main/ipc/dialog.ipc.ts                      — openFile对话框
src/main/ipc/window.ipc.ts                      — setBackgroundColor
src/preload/preload.ts                          — 新增API桥接
src/renderer/types/electron.d.ts               — 类型声明
```

---

## 第五轮修复：面板拖拽 + 首次启动空白 + Tailwind CSS变量兼容（2026-07-03 12:13）

### Bug: 首次启动选择工程目录后一片空白

**现象：** 首次启动→选择文件夹→主界面空白，什么都不展示。

**排查过程：**
1. 检查 `initWidths` 是否正确初始化 visibility flags → 正确，全部为 true
2. 检查 `showEditorPanel` 派生逻辑 → 正确，`hasOpenFiles || showEditor`
3. 检查面板 CSS `display:none` 逻辑 → 正确，条件满足时 `display: undefined`
4. 检查 `visiblePanels` useEffect 是否造成死循环 → 无，用 `useRef` 追踪变化
5. 检查子组件是否会崩溃 → 逐个排查无异常
6. **关键发现：`tailwind.config.js` 颜色改为 `var(--xxx)` 后，Tailwind JIT 引擎处理带透明度修饰符的 class（如 `bg-bg-deep/90`）时生成无效 CSS**

**根因：** Tailwind v3 JIT 引擎处理 `var(--xxx)` 作为颜色值时，基础 class（无透明度）正确生成 `background-color: var(--bg-deep)`，但带透明度修饰符时（如 `bg-bg-deep/90`）会尝试生成 `background-color: rgb(var(--bg-deep) / 0.9)`，这无法正确解析 CSS 变量。浏览器忽略该规则，元素失去背景色。

**受影响位置（6处）：**
| 文件 | 原代码 | 修复 |
|------|--------|------|
| QuickTools.tsx | `bg-bg-deep/90` | `bg-bg-deep` |
| PluginPanel.tsx | `hover:bg-bg-hover/50` | `hover:bg-bg-hover` |
| EverythingSearch.tsx | `border-border-subtle/50 bg-bg-deep/30` | `border-border-subtle bg-bg-deep` |
| EverythingSearch.tsx | `border-border-subtle/30 bg-bg-deep/30` | `border-border-subtle bg-bg-deep` |
| EverythingSearch.tsx | `border-border-subtle/20` | `border-border-subtle` |

此外还有大量 `bg-accent/15`、`bg-accent/20`、`text-accent/70` 等带透明度修饰符的 class，这些虽然不会导致空白，但透明度效果会静默失效（选中态、悬停态的背景色不显示）。

### 可见面板数变化自动等分宽度优化

**问题1：** useEffect 依赖数组包含派生变量 `showEditorPanel`，虽不会造成死循环但增加了不必要的重计算。

**修复：** 用 `useRef(visiblePanels)` 追踪上次面板数，仅在数量真正变化时触发等分逻辑。依赖数组简化为 `[visiblePanels]`。

**问题2：** 2个面板时，所有可能的组合需要分别处理宽度分配策略。

```typescript
if (visiblePanels === 2) {
  if (showTerminal && showEditorPanel) {
    s.setLeftWidth(equal); s.setCenterWidth(equal);
  } else if (showTerminal && showFileBrowser) {
    s.setLeftWidth(equal); s.setBrowserWidth(equal);
  } else if (showTerminal && showEverythingSearch) {
    s.setLeftWidth(equal);
  } else if (showEditorPanel && showFileBrowser) {
    s.setCenterWidth(equal); s.setBrowserWidth(equal);
  } else if (showFileBrowser && showEverythingSearch) {
    s.setBrowserWidth(equal);
  }
}
```

### 面板拖拽分割线条件修复

**问题：** 只有终端+文件浏览器两个面板时，中间分割线不渲染，因为原条件 `showTerminal && showEditorPanel` 要求编辑器也必须可见。

**修复：** 改为 `showTerminal && (showEditorPanel || showFileBrowser || showEverythingSearch)`，只要终端右侧有任何可见面板就显示分割线。

**问题：** 文件浏览器宽度策略——右侧有搜索时固定像素+分割线，右侧无搜索时 `flex:1` 自动填满至右边缘。

---

## Tailwind CSS变量 + JIT引擎兼容性总结

### 可行的用法
```
bg-bg-deep        → background-color: var(--bg-deep)           ✅
text-text-primary → color: var(--text-primary)                 ✅
border-border-subtle → border-color: var(--border-subtle)      ✅
```

### 不可行的用法（透明度修饰符静默失效）
```
bg-bg-deep/90        → 生成无效CSS，背景透明                    ❌
bg-accent/15         → 选中态背景色不显示                       ❌
text-accent/70       → 文字不显示半透明效果                      ❌
border-border-subtle/50 → 边框透明度失效                        ❌
```

### 解决方案
如需透明度效果，使用以下替代方案：
1. **CSS变量中直接包含alpha**：`--glass-bg: rgba(26, 27, 38, 0.85)` → 用 `bg-glass-bg` class
2. **inline style**：`style={{ backgroundColor: 'var(--accent)' , opacity: 0.15 }}`
3. **Tailwind arbitrary values**：`bg-[var(--accent)]/15` （但此语法在 JIT 中同样不可靠）

推荐方案1：在 CSS 变量定义中预计算 alpha 值。

---

## 全部5轮修改统计

| 轮次 | 日期 | 修改数 | 新建文件 | 修改文件 |
|------|------|--------|---------|---------|
| 第一轮 | 07-03 10:00 | 11项 | 3 | 14 |
| 第二轮 | 07-03 11:00 | 4项 | 0 | 8 |
| 第三轮 | 07-03 11:15 | 6项 | 1 | 6 |
| 第四轮 | 07-03 12:00 | 4项 | 7(GitHub文档) | 3 |
| 第五轮 | 07-03 12:13 | 3项 | 0 | 5 |
| 第六轮 | 07-05 14:00 | 布局拖拽+拖拽排序+磨砂玻璃 | 2 | 12 |
| 第七轮 | 07-05 17:00 | 6项细节打磨+终端焦点 | 0 | 6 |
| **合计** | | **37+项** | **13文件** | **23+文件** |

---

## 第六轮：面板布局拖拽 + 拖拽排序 + 磨砂玻璃主题（2026-07-05）

### 背景

用户要求三个核心功能：
1. 三列一横布局下所有边框可拖拽调整大小
2. 长按工具头部栏拖拽交换任意工具位置
3. 全局磨砂玻璃透明主题

### 功能 1：三列一横布局拖拽修复

**问题**：三列一横布局中，顶部横排与底部EverythingSearch之间只有`height: 6`的空div，没有可拖拽的PanelResizer；垂直分割线条件过于严格；底部面板高度硬编码`calc(35%-14px)`。

**修复**：
- `useLayoutStore`新增`bottomHeight`字段
- 三列一横布局顶部/底部之间插入`<PanelResizer direction="vertical" />`
- 修复垂直分割线条件：`showTerminal && showEditor` → `showTerminal && (showEditor || showFileBrowser)`
- 底部面板改用动态`bottomHeight`

**教训**：`setBottomHeight`必须加`Math.min(window.innerHeight - 250, ...)`上限，否则拖拽后topHeight变为负值导致底栏消失。

---

### 功能 2：拖拽排序面板

**架构设计**：`panelOrder: string[]` 驱动面板渲染顺序，`swapPanels(fromId, toId)` 交换位置。使用 Framer Motion `layout` prop 实现平滑过渡动画。

**关键技术点**：

1. **DraggablePanelHeader 组件**：模块级变量（非 React state）追踪拖拽状态，避免高频 re-render。200ms 长按激活拖拽。

2. **CSS order vs 动态渲染**：最初使用 CSS `order` 属性重排面板，但会导致 PanelResizer 位置错乱（DOM 位置不变，视觉位置变了）。改为动态渲染——按 `panelOrder` 顺序遍历可见面板，Resizer 精确放在相邻面板之间。

3. **React Hooks 顺序陷阱**：`useMemo` 如果在 `if` 条件返回之后定义，则只有默认布局调用它，水平布局提前 return 跳过，导致 React hooks 调用次数不一致 → 白屏崩溃。**必须将所有 hooks 放在所有条件 return 之前**。

4. **拖拽后残留边框**：`handlePointerUp` 先 swap 再 `clearDragState()`，中间渲染态带 ring。**必须先 `clearDragState()` 再 swap**。

5. **动画参数调优**：`spring stiffness:350 damping:35 mass:0.5` + CSS transition `0.2s cubic-bezier(0.25, 0.1, 0.25, 1)` 达到 60fps 丝滑感。

6. **抬起效果**：`scale(1.04) translateY(-6px)` + 大阴影模拟面板被"抓起"；相邻面板 `scale(0.96)` 表示"让位"；目标面板 `scale(1.03)` + `boxShadow: 0 0 0 2px var(--accent)`。

---

### 功能 3：磨砂玻璃透明主题

**设计迭代**：
1. **第一版**：暗色半透明（`rgba(18,18,24,0.50)`）→ 用户反馈"不对"
2. **第二版**：纯白半透明 → 用户反馈"应该是淡蓝色毛玻璃质感"
3. **第三版（最终）**：淡蓝 Acrylic 风格（`rgba(228,235,250,0.30)`），blur 32px，body blur 22px

**关键实现**：
- Electron 主进程：`transparent: true` + `backgroundColor: '#00000000'` + `backgroundMaterial: 'acrylic'`
- CSS 分层透明度：窗口透明 → body 30%不透明/blur 22px → glass-panel 48%不透明/blur 32px → 内容区 86-90%不透明
- Tailwind 不支持 `bg-bg-deep/90` 与 CSS 变量组合（生成 `rgb(var(--x) / 0.9)` 无效 CSS）

**启动主题一致性问题**：`index.html` 预加载样式只定义暗色主题。修复：在 `<script>` 中读取 `localStorage('mlx-theme')`，提前设置 `document.documentElement.dataset.theme`。

---

### 功能 4：终端焦点永久保障

**问题**：终端经常无法输入文字——PanelResizer拖拽、面板排序、菜单点击、布局切换后焦点丢失。

**根因**：xterm.js 内部使用隐藏 textarea 接收键盘输入。焦点离开后无自动恢复机制。

**修复（4层保障）**：
1. **TerminalPanel onClick**：点击面板任意位置 → `requestAnimationFrame(() => focus())`
2. **useEffect 多阶段聚焦**：showTerminal/activeId 变化 → 0ms/100ms/300ms 三重 setTimeout
3. **所有 PanelResizer onDragEnd** → `setTimeout(() => focusActiveTerminal(), 50)`
4. **XTerm 三重事件监听**：`pointerdown` + `mousedown` + `touchstart` capture phase

---

## 第七轮：细节打磨（2026-07-05）

### 双击标题栏全屏
**修复**：AppShell 标题栏 div 添加 `onDoubleClick` → `window.electronAPI.window.maximize()`。

### 修改文件统计（第六/七轮）

| 文件 | 改动内容 |
|------|---------|
| `useLayoutStore.ts` | 新增 `bottomHeight`, `panelOrder`, `swapPanels`, `setPanelOrder`；`setBottomHeight` 加 clamp |
| `AppMain.tsx` | 三列一横水平resizer + 动态面板渲染替代CSS order + 拖拽动效 + 全部resizer refocus |
| `DraggablePanelHeader.tsx` | **新建** — 长按检测 + pointer拖拽 + 抬起动效 + refocus |
| `main.ts` | `transparent: true` + `backgroundMaterial: 'acrylic'` |
| `index.css` | frosted-glass 淡蓝主题 + 全局backdrop-filter + 内容区可读性 |
| `useThemeStore.ts` | `frosted-glass` 第4内置主题 + 配色迭代 |
| `AppShell.tsx` | 主题菜单 + 双击全屏 |
| `ThemeManager.tsx` | frosted-glass 注册 |
| `TerminalPanel.tsx` | onClick聚焦 + setFocusFn注册 + 多阶段聚焦 |
| `XTerm.tsx` | 三重事件监听聚焦 |
| `FileBrowser.tsx` | DraggablePanelHeader 包裹 |
| `EditorPanel.tsx` | DraggablePanelHeader 包裹 |
| `EverythingSearch.tsx` | DraggablePanelHeader 包裹 |
| `index.html` | 启动主题检测脚本 |

---

## 经验教训总结（供后续开发参考）

### React/架构
1. **所有 hooks 必须在条件 return 之前** — 违反导致白屏
2. **CSS order 不适合与 DOM-dependent 组件混用** — PanelResizer 位置错乱
3. **模块级变量 > Zustand store** 用于高频拖拽状态（避免 re-render）
4. **先清状态再操作** — `clearDragState()` 必须在 `swapPanels()` 之前

### 动画
5. **Framer Motion layout prop** 是面板交换动画的最佳方案
6. **spring stiffness:350 damping:35 mass:0.5** + CSS `cubic-bezier(0.25, 0.1, 0.25, 1)` 达到丝滑 60fps
7. **抬起效果** = `scale(1.04) + translateY(-6px) + 大阴影 + opacity:0.88`

### 毛玻璃主题
8. **淡蓝色调**（`rgba(228,235,250,0.30)`）更接近 Windows Acrylic
9. **分层透明度**：窗口0% → body 30% → glass 48% → 内容区 86-90%
10. **blur 越大穿透感越强**：body 22px，glass-panel 32px
11. **Tailwind CSS变量 + 透明度修饰符不兼容** — 用 CSS 预计算 rgba
12. **启动主题闪烁** — `index.html` 加 script 读 localStorage

### 终端焦点
13. **xterm.js 焦点极易丢失** — 需要多层保障机制
14. **onClick + onDragEnd + useEffect + capture事件** 四重保障
15. **`setPointerCapture` 是焦点杀手** — PanelResizer/DraggablePanelHeader 拖拽后必须手动 refocus

### 打包
16. **`npm run build` 必须先于 `electron-builder`** — 否则 asar 含旧代码
17. **每次修改后必须重新 tsc+build+package** — dist 不会自动更新

---

## 第八轮：7项Bug修复与Claude工具子系统（2026-07-06）

### 背景

用户反馈4个原有问题 + 追加3个问题（含三列一横布局bug、Claude工具子系统需求、拖拽动效问题），共7项。明确要求新增工具与原有面板在交互逻辑、主题配色、QuickTools图标行为上完全一致，不得重复历史Bug。

---

### Bug 1：终端焦点永久保障（多层兜底）

**问题**：关闭任何非终端面板后，点击终端无法输入文字。

**根因1（面板切换无重聚焦）**：`useLayoutStore` 的 `setShowFileBrowser`/`setShowEditor`/`setShowEverythingSearch` 切换面板可见性后，没有任何代码调用 `focusActiveTerminal()`。之前的焦点恢复只在 PanelResizer/DraggablePanelHeader 拖拽结束时触发。

**根因2（setFocusFn竞态条件）**：TerminalPanel（mount时注册一次，deps=[]）和 XTerm（每次sessionId变化时注册）都调用 `setFocusFn()`。XTerm后注册覆盖TerminalPanel的版本。当XTerm dispose（tab关闭/切换）时，它将fn设为null，但TerminalPanel不会重新注册。导致XTerm dispose后全局`focusActiveTerminal`永久为null。

**修复**：
- `useLayoutStore.ts`：全部7个面板hide setter中添加终端重聚焦逻辑（`focusActiveTerminal?.()` 延迟50ms）
- `XTerm.tsx`：移除`setFocusFn()`调用和dispose时的null化，消除竞态
- `TerminalPanel.tsx`：onClick增加setTimeout(100ms)兜底

**涉及文件**：`useLayoutStore.ts`、`XTerm.tsx`、`TerminalPanel.tsx`

---

### Bug 2：三列一横布局底部拖拽条导致面板关闭

**问题**：三列一横布局中，拖动底部EverythingSearch上方分割线时，搜索面板消失/关闭。

**根因**：`useLayoutStore` 中所有宽度/高度 setter（setLeftWidth/setCenterWidth/setRightWidth/setBrowserWidth/setBottomHeight）都带了`layoutMode: 'free'`。拖动底部resizer时，`setBottomHeight` 将layoutMode改为'free'，整个DOM从三列一横布局切换到自由排版，resizer断开导致面板消失。

**修复**：5个setter全部移除`layoutMode: 'free'`，layoutMode只由用户主动选择视图菜单时改变。

**涉及文件**：`useLayoutStore.ts`

---

### Bug 3：编辑器关闭所有文件后，重启仍自动恢复旧文件

**问题**：手动关闭所有编辑器标签页，退出MLX后重新打开，已关闭的文件又被恢复到编辑器中。

**根因**：`AppMain.tsx` 的 `handleBeforeUnload` 中，当`openFiles.length === 0`时直接return，不清理旧的localStorage session数据。下次启动loadSession()仍读到旧缓存。

**修复**：当openFiles为空时调用`clearSession()`清除localStorage中的mlx-session。

```typescript
if (editor.openFiles.length === 0) {
  clearSession();
  return;
}
```

**涉及文件**：`AppMain.tsx`

---

### Bug 4：拖动面板边框后动效过于缓慢夸张、不跟手

**问题**：拖动panel边框调整大小时，面板宽度变化有明显延迟和弹跳过冲效果，与鼠标不同步。

**根因**：面板使用Framer Motion的`motion.div layout` + spring动画（stiffness:350 damping:35 mass:0.5），spring的惯性延迟和过冲导致面板宽度远远滞后于鼠标位置。

**修复**：
- 自由布局面板：`motion.div layout`改为条件启用（仅拖拽排序时启用），平时width变化用CSS transition
- 三列一横布局面板：全部从`motion.div`改为普通`div`
- `index.css`新增`.panel-slot { transition: width 0.05s ease-out; }`实现即时跟随
- 拖拽排序spring参数降低mass到0.3、提高damping到45，减少夸张感

**教训**：**Framer Motion layout spring不能用于即时跟随鼠标的resize场景**。spring适合离散的位置交换（drag-to-reorder），不适合连续的尺寸变化。resize用CSS `transition: width 0.05s`即可。

**涉及文件**：`AppMain.tsx`、`index.css`

---

### Bug 5：双击标题栏全屏/缩小

**问题**：双击标题栏应触发窗口最大化/还原，但之前`-webkit-app-region: drag`阻塞了双击事件。

**修复**：将`onDoubleClick`从外层`titlebar-drag` div移到内层`titlebar-no-drag`包裹的MLX/Slogan区域。

**涉及文件**：`AppShell.tsx`

---

### 功能 11：删除磨砂玻璃透明主题

**描述**：用户要求删除frosted-glass（磨砂玻璃）主题。

**删除范围（6个文件）**：
| 文件 | 删除内容 |
|------|---------|
| `useThemeStore.ts` | BuiltInThemeId类型、BUILT_IN_THEMES条目；`loadThemeId()`添加迁移逻辑（frosted-glass→dark） |
| `index.css` | frosted-glass CSS变量块（~20行）+ 运行时覆盖规则（~40行） |
| `AppShell.tsx` | "磨砂玻璃"主题菜单项 |
| `ThemeManager.tsx` | BUILT_IN_NAMES/IDS中frosted-glass条目 |
| `index.html` | 启动脚本frosted-glass检测分支 |
| `main.ts` | `transparent: true`、`backgroundMaterial: 'acrylic'`、`backgroundColor: '#00000000'` → 改为`backgroundColor: '#1a1b26'` |

---

### 功能 12：ThemeManager透明度滚动条

**描述**：为主题自定义界面所有控件提供透明度滑块。

**实现**：
- `ThemeColors`接口新增`globalOpacity`字段
- `applyColors()`同步设置`--global-opacity` CSS变量
- `index.css`：`#root { opacity: var(--global-opacity); transition: opacity 200ms ease; }`
- ThemeManager新增"透明度"分组（7个滑块）：全局透明度(50-100%)、主背景透明度、面板背景、输入框背景、毛玻璃、边框、滚动条(各10-100%)
- 辅助函数`extractAlpha()`解析rgba中alpha值、`setAlpha()`修改颜色alpha通道（支持hex→rgba转换）

**教训**：`input[type=color]`只支持hex值，无法直接编辑rgba的alpha。用text input配合range slider实现alpha调节更直观。

**涉及文件**：`useThemeStore.ts`、`ThemeManager.tsx`、`index.css`

---

### 功能 13：Claude工具子系统（4个新面板）

**这是本轮最大的改动**，新增4个完整的Claude集成工具面板。

#### 架构设计

所有新面板严格遵循现有面板模式：
- DraggablePanelHeader包裹标题栏 + glass-panel容器
- CSS `display:none`隐藏（不是条件渲染，保留状态）
- Tailwind CSS变量class（不使用透明度修饰符）
- QuickTools绝对定位图标（16px图标、w-7 h-7按钮、自动检测隐藏/可见）
- 关闭按钮统一hover:bg-red-500/20 + VscClose
- 面板关闭后自动触发终端重聚焦

#### 面板1：对话管理器 (ConversationManager)

- 读取`~/.claude/projects/`下JSONL会话文件
- 列表显示：标题（从首条user消息提取）、日期、消息数
- 点击恢复对话→终端执行`claude --resume <id>`
- 右键删除对话（删除JSONL文件）
- 刷新按钮重新扫描

#### 面板2：Skill管理器 (SkillManager)

- 扫描`~/.claude/skills/`和`~/.claude/builtin-skills/`
- 解析SKILL.md的YAML frontmatter提取name/description
- 显示来源标签（内置=蓝色、用户=绿色）
- 导入按钮→文件选择对话框→复制到skills目录→终端执行安装命令
- 用户级skill可删除

#### 面板3：MCP配置查看器 (McpConfigTool)

- 读取`~/.claude/mcp.json`或`~/.mcp.json`
- 只读显示MCP服务列表（名称、命令、参数、环境变量数）
- 显示配置文件路径

#### 面板4：浏览器 (BrowserTool)

- Electron webview标签嵌入（main.ts启用`webviewTag: true`）
- 地址栏+前进/后退/刷新按钮+Enter导航
- 自动补全`https://`前缀
- did-navigate事件同步地址栏状态

#### IPC通道

新增8个IPC通道：
| 通道 | 用途 |
|------|------|
| `claude:conversations-list` | 扫描并返回对话列表 |
| `claude:conversation-resume` | 返回恢复命令 |
| `claude:conversation-delete` | 删除对话文件 |
| `claude:skills-list` | 扫描并返回Skill列表 |
| `claude:skill-install` | 选择.md文件安装 |
| `claude:skill-delete` | 删除Skill目录 |
| `claude:mcp-config` | 读取MCP配置JSON |

#### 新增文件（11个）
```
src/main/ipc/claude-tools.ipc.ts              — IPC handler（~240行）
src/renderer/stores/useConversationStore.ts    — 对话列表Zustand store
src/renderer/stores/useSkillStore.ts           — Skill列表Zustand store
src/renderer/stores/useMcpStore.ts             — MCP配置Zustand store
src/renderer/components/tools/ConversationManager.tsx — 对话管理面板
src/renderer/components/tools/SkillManager.tsx  — Skill管理面板
src/renderer/components/tools/McpConfigTool.tsx  — MCP配置面板
src/renderer/components/tools/BrowserTool.tsx   — 浏览器面板
```

#### 修改文件（8个）
```
src/shared/ipc-channels.ts          — 新增8个通道常量
src/main/main.ts                    — 注册IPC + webviewTag:true
src/preload/preload.ts              — 暴露claudeTools API
src/renderer/types/electron.d.ts    — 类型声明
src/renderer/stores/useLayoutStore.ts — 4个visibility字段+setter+panelOrder
src/renderer/AppMain.tsx            — 面板注册+visibleSlots+visiblePanels
src/renderer/components/layout/QuickTools.tsx  — 4个新图标按钮
src/renderer/components/layout/AppShell.tsx    — View菜单4个新checkbox
src/renderer/components/layout/DraggablePanelHeader.tsx — PanelId类型扩展
```

---

## 经验教训总结（第八轮新增）

### 终端焦点
18. **setFocusFn竞态条件是沉默的焦点杀手** — 两个组件注册同一个全局回调，后注册覆盖前者，dispose时null化导致全局回调永久失效。解决方案：只让一个常驻组件（TerminalPanel）注册，XTerm不参与全局注册。
19. **面板hide时必须触发终端重聚焦** — 不仅是拖拽结束，关闭面板、菜单切换、QuickTools打开都会导致焦点丢失

### 布局系统
20. **setter中不应改变layoutMode** — 宽度/高度setter的职责是更新尺寸，布局模式只能由用户显式选择。在setter中附带改变layoutMode会导致拖拽时DOM重建、事件断开
21. **Framer Motion layout spring ≠ resize动画** — spring适合离散的位置交换，连续尺寸跟随必须用CSS transition

### 主题系统
22. **删除内置主题需要迁移逻辑** — `loadThemeId()`中检测旧ID并回退到默认值，否则已选择该主题的用户启动时行为未定义
23. **`input[type=color]`只支持hex** — 编辑rgba颜色需要text input配合

### Claude工具子系统
24. **新面板必须从第一天起遵循所有现有模式** — 不然后续修复现有模式bug时新面板会成为漏网之鱼
25. **IPC handler必须导出注册函数** — 不能直接在模块顶层调用ipcMain.handle()，需要export function由main.ts统一调用
26. **PanelId联合类型是面板注册的关键约束** — 新增面板ID时必须同步扩展DraggablePanelHeader的PanelId类型

---

## 全部8轮修改统计

| 轮次 | 日期 | 修改数 | 新建文件 | 修改文件 |
|------|------|--------|---------|---------|
| 第一轮 | 07-03 10:00 | 11项 | 3 | 14 |
| 第二轮 | 07-03 11:00 | 4项 | 0 | 8 |
| 第三轮 | 07-03 11:15 | 6项 | 1 | 6 |
| 第四轮 | 07-03 12:00 | 4项 | 7(GitHub文档) | 3 |
| 第五轮 | 07-03 12:13 | 3项 | 0 | 5 |
| 第六轮 | 07-05 14:00 | 布局拖拽+拖拽排序+磨砂玻璃 | 2 | 12 |
| 第七轮 | 07-05 17:00 | 6项细节打磨+终端焦点 | 0 | 6 |
| 第八轮 | 07-06 22:00 | 7项修复+Claude工具子系统 | 11 | 12 |
| **合计** | | **52+项** | **24文件** | **35+文件** |

---

## 第八轮补充修复（2026-07-06 22:30）

用户测试第八轮打包后反馈5个问题：

### Bug 1：对话管理工具无法看到内容

**根因**：IPC扫描路径过于局限——只扫描`~/.claude/projects/`下子目录中的.jsonl文件。实际Claude Code的对话存储可能有多种布局（.claude根目录、conversations子目录等），且JSON格式多样（content可能是字符串、数组、或使用message/text字段）。

**修复**：
- 扩展扫描范围：同时扫描`~/.claude/`、`~/.claude/projects/`、`~/.claude/conversations/`
- 递归扫描子目录中的.jsonl文件
- 兼容多种JSON格式：`content`为字符串/数组、`message`字段、`text`字段
- UI新增错误提示栏和对话计数

### Bug 2：终端无法输入交互

**根因**：上一轮移除XTerm.tsx中setFocusFn调用后，虽然有TerminalPanel的注册兜底，但XTerm dispose时不再nullify。然而问题是：XTerm的cleanup和mount执行顺序在React中会导致新XTerm注册→旧XTerm cleanup nullify覆盖→focusActiveTerminal永久为null。

**修复**：在XTerm.tsx中恢复setFocusFn注册（确保指向当前活跃终端），但不在cleanup中nullify。利用闭包中的`disposed`标志位保证旧终端不会响应focus调用。

### Bug 3：MCP配置没有添加按钮

**根因**：McpConfigTool设计为只读查看器，缺少编辑能力。

**修复**：
- 新增IPC通道`CLAUDE_MCP_SAVE`（写入mcp.json）
- McpConfigTool完全重写：新增"编辑配置"按钮 → 进入编辑模式 → 表单添加服务器（名称+命令+参数） → 保存到磁盘 → 可删除已有服务器
- 保存/取消/添加三个按钮，绿色保存反馈

### Bug 4：手工关闭的文件二次打开还有缓存

**根因**：仅修复beforeunload不够。如果用户关闭文件后应用崩溃，或localStorage中仍有旧session，启动时仍会恢复。

**修复**：
- 在`loadSession()`后增加验证：检查session中是否有真实文件路径。如果所有文件都是clean且无路径（空session），调用`clearSession()`
- 保留beforeunload的clearSession逻辑作为双重保障

### Bug 5：浏览器无法输入网址，无法交互

**根因**：webview标签创建独立renderer进程，加载后自动抢占焦点，地址栏input失去焦点无法接收键盘输入。

**修复**：
- input添加ref + onFocus处理器：阻止webview偷走焦点
- Enter导航后主动将焦点移到webview（地址栏→页面）
- 添加`dom-ready`事件监听确保webview加载完成后获得焦点
- 添加页面标题显示在标题栏
- 修复disabled按钮的CSS（使用inline style opacity避免Tailwind透明度修饰符失效）

### 关键教训（补充）

27. **Claude对话存储无标准结构** — 需要多路径扫描 + 多JSON格式兼容，不能假设单一布局
28. **setFocusFn nullify是沉默杀手** — React effects的cleanup/mount执行顺序（子→父）导致新注册被旧cleanup覆盖。解决：不在cleanup中nullify，用disposed标志位兜底
29. **session持久化需要防御性编程** — 不能只依赖beforeunload（崩溃时不触发），启动时也要验证数据有效性
30. **webview会偷走焦点** — Electron webview是独立进程，加载完成后自动聚焦。宿主页面的input需要明确的焦点管理策略

---

## 第八轮补充修复 2（2026-07-06 23:00-23:50）

### 背景

用户测试后反馈5个深层问题 + 对话管理架构重构 + 面板拖拽能力补全 + 最大化状态保持。

---

### Bug 6：对话管理按 sessionId 分组（架构级修复）

**问题**：对话列表把所有 200 条记录全部平铺，每行 = history.jsonl 中的一条提问，没有按会话分组。

**根因分析**：探查 `.claude` 实际目录结构后发现：
- `~/.claude/history.jsonl` 是一个 200 行的大文件，每行 = 一次用户提问（同一个 sessionId 最多出现 14 次）
- 真正的对话消息存储在 `~/.claude/projects/<project-dir>/<sessionId>.jsonl`
- project 目录命名规则：`D:\MLXObsidianDOC\MLX_AI` → `D--MLXObsidianDOC-MLX_AI`（冒号→短横，反斜杠→短横）

之前的代码：
1. 完全不读 `history.jsonl`（只扫描 project 子目录中的 .jsonl 文件）
2. 每条记录当作独立"对话"平铺
3. project 路径映射错误（`.replace(/[\\/]/g, '-').replace(/^[A-Z]:-?/i, '')` 把盘符也删了，导致找不到消息文件）

**修复**：
- 列表 handler 完全重写：主数据源改为 `history.jsonl`，按 `sessionId` 分组（Map 结构）
- 每组 = 一个"大对话"：标题取第一条 `display`、时间取最新 timestamp、条目数 = 该 session 在 history.jsonl 中的行数
- 消息数：去 `projects/<project-dir>/<sessionId>.jsonl` 统计实际行数（含 user+assistant 完整对话）
- 路径映射修正：`project.replace(/:/g, '-').replace(/[\\/]/g, '-')` → `D--MLXObsidianDOC-MLX_AI`，与 `.claude/projects/` 实际目录名一致
- 新增 IPC `claude:conversation-messages`：读取指定 sessionId 的完整 JSONL 消息文件

**教训**：
31. **Claude Code 数据模型理解是关键** — `history.jsonl` 是提问索引，`.jsonl` 在 projects 子目录是完整对话。数据分布在两处，需要关联查询
32. **Windows 路径 → 目录名映射规则** — 盘符 `:` 和路径分隔符 `\` 都替换为 `-`，不是删除盘符

---

### Bug 7：双击最大化/还原后自动打开已关闭的工具面板

**问题**：手动关闭文件浏览器后，双击标题栏最大化 → 文件浏览器自动重新打开。

**根因**：`initWidths()` 在每次 window resize 时被调用（包括最大化/还原），它重置了 `showTerminal: true`、`showEditor: true`、`showFileBrowser: true`，覆盖了用户手动关闭操作。

```typescript
// useLayoutStore.ts — 旧代码
initWidths: (totalWidth) => set({
  leftWidth: ...,
  showTerminal: true,        // ← 无条件重置！
  showEditor: true,          // ← 无条件重置！
  showFileBrowser: true,     // ← 无条件重置！
});
```

**修复**：`initWidths` 移除所有 visibility setter，改为按当前可见面板等比缩放 `panelWidths`，不改变面板可见性。

**涉及文件**：`useLayoutStore.ts`

**教训**：
33. **resize handler 不应改变 UI 状态** — 窗口尺寸变化的回调只应调整尺寸，不应覆盖用户手工设置的可见性/布局等状态

---

### Bug 8：新增面板（MCP/浏览器/对话管理等）右边框无法拖动改变大小

**问题**：原有 3 个面板（终端/编辑器/文件浏览器）可拖动边框调整宽度，但新增的 8 个面板中索引 3+ 的完全无法拖动。

**根因**：`handleSlotResize` 只处理索引 0/1/2（硬编码映射到 leftWidth/centerWidth/browserWidth 三个命名槽位），索引 3+ 无任何逻辑。

**修复**：
- `useLayoutStore` 新增 `panelWidths: Record<string, number>` — 每个面板独立宽度追踪，8 个面板各有默认宽度
- `setPanelWidth(panelId, w)` setter 更新单面板宽度
- `handleSlotResize` 重写为泛用逻辑：取左右两个相邻面板 ID → 读 `panelWidths[id]` → delta 分配 → 双方 clamp 到 minWidth
- `getSlotWidth` 改为按 `panelId` 查询（而非固定 3 槽位索引映射）
- `distributeWidths` 遍历所有可见面板等分宽度
- `setLeftWidth`/`setCenterWidth`/`setBrowserWidth` 同步更新 `panelWidths`（保持三列布局兼容）

**涉及文件**：`useLayoutStore.ts`、`AppMain.tsx`

**教训**：
34. **不要用固定数量的命名槽位处理动态面板集合** — 面板数量从 3 增长到 8 时，硬编码索引的全部逻辑都需要重构。应该用 `Map<panelId, width>` 从一开始就支持任意数量

---

### 功能 14：对话消息纯文本展示 + Token 用量统计

**问题**：对话详情中显示了原始 JSON 结构（包括 thinking/tool_use/content 数组等），用户只需要看到对话交互内容。且缺少 token 用量信息。

**数据格式探明**：JSONL 中每条消息的实际结构：
- 外层：`type: "user"|"assistant"` + `message`（嵌套 JSON，已解析为 object）
- user 消息：`message.content` 是字符串
- assistant 消息：`message.content` 是数组 `[{type:"text"|"thinking"|"tool_use", text/thinking/input: ...}]`
- `message.usage`：`{input_tokens: N, output_tokens: N}`（仅 assistant 消息有）
- `message.model`：模型名（如 `deepseek-v4-pro`, `claude-fable-5`）

**修复**：
- **内容提取**：User 消息直接显示 `message.content` 字符串；Assistant 消息只提取 `content[]` 中 `type === "text"` 的 `.text`，跳过 thinking/tool_use 块
- **Token 统计**：遍历所有消息累加 `input_tokens` + `output_tokens`；根据 `message.model` 自动识别上下文窗口大小（DeepSeek v4 Pro: 128K, Claude: 200K, 未知: 200K）；计算使用比例和剩余 tokens
- **UI 展示**：每条消息头部显示 ↑输入/↓输出 token 数；对话最后一条消息下方显示完整统计卡片（模型、输入、输出、总计、上下文窗口、使用比例颜色条、剩余可用、可视化进度条）

**涉及文件**：`claude-tools.ipc.ts`（messages handler 重写）、`ConversationManager.tsx`（完全重写）

**教训**：
35. **Claude JSONL 消息格式是嵌套结构** — `message` 字段是内层 JSON（object 而非 string），content 是数组而非字符串。必须按 type 过滤 content blocks
36. **token 信息只在 assistant 消息中** — user 消息没有 usage 字段，统计时需要跳过
37. **模型上下文窗口需要硬编码映射表** — 没有 API 可直接查询，需要维护 MODEL_CONTEXT 字典

---

### 功能 15：对话管理 UI 重构（列表 + 详情两级视图）

**实现**：
- 列表视图：按 sessionId 分组后的对话列表，显示标题、日期、消息数
- 点击对话 → 详情视图：左侧返回箭头 + 对话标题 + "恢复到终端"按钮 + 消息气泡列表 + Token 统计卡片
- 消息气泡：user 右对齐蓝色（`bg-accent/15`）、assistant 左对齐深色（`bg-bg-base`）、显示时间和角色标签
- Token 统计卡片：grid 布局显示完整用量 + 颜色进度条（<50% 绿 / 50-80% 黄 / >80% 红）

**涉及文件**：`ConversationManager.tsx`（完全重写 ~200 行）、`useConversationStore.ts`（新增 messages + selectedId 状态）

---

## 经验教训总结（第八轮补充新增）

### Claude 数据理解
31. **Claude Code 数据模型理解是关键** — `history.jsonl` 是提问索引，`.jsonl` 在 projects 子目录是完整对话。数据分布在两处，需要关联查询
32. **Windows 路径 → 目录名映射规则** — 盘符 `:` 和路径分隔符 `\` 都替换为 `-`，不是删除盘符
35. **Claude JSONL 消息格式是嵌套结构** — `message` 字段是内层 JSON object，content 是数组。必须按 type 过滤 content blocks（text/thinking/tool_use）
36. **token 信息只在 assistant 消息中** — user 消息没有 usage 字段，统计时需要跳过
37. **模型上下文窗口需要硬编码映射表** — 没有 API 可直接查询，需要维护 MODEL_CONTEXT 字典

### 布局架构
33. **resize handler 不应改变 UI 状态** — 窗口尺寸变化的回调只应调整尺寸，不应覆盖用户手工设置的可见性/布局等状态
34. **不要用固定数量的命名槽位处理动态面板集合** — 面板数量从 3 增长到 8 时，硬编码索引的全部逻辑都需要重构。应该用 `Map<panelId, width>` 从一开始就支持任意数量

---

## 全部 8 轮修改统计（更新）

| 轮次 | 日期 | 修改数 | 新建文件 | 修改文件 |
|------|------|--------|---------|---------|
| 第一轮 | 07-03 10:00 | 11项 | 3 | 14 |
| 第二轮 | 07-03 11:00 | 4项 | 0 | 8 |
| 第三轮 | 07-03 11:15 | 6项 | 1 | 6 |
| 第四轮 | 07-03 12:00 | 4项 | 7(GitHub文档) | 3 |
| 第五轮 | 07-03 12:13 | 3项 | 0 | 5 |
| 第六轮 | 07-05 14:00 | 布局拖拽+拖拽排序+磨砂玻璃 | 2 | 12 |
| 第七轮 | 07-05 17:00 | 6项细节打磨+终端焦点 | 0 | 6 |
| 第八轮 | 07-06 22:00 | 7项修复+Claude工具子系统 | 11 | 12 |
| 第八轮补充 | 07-06 23:00 | 对话框分组+面板resizer+最大化状态+纯文本+Token统计 | 0 | 5 |
| 第九轮 | 07-07 00:00 | 双击exe无法打开修复（app.asar缺失） | 0 | 0 |
| **合计** | | **61+项** | **24文件** | **40+文件** |

---

## 第九轮：双击exe无法打开软件修复（2026-07-07）

### 问题

双击 `release/win-unpacked/MLX.exe` 无任何反应，窗口不出现，进程静默退出。

### 根因

`app.asar` 仅 24KB，只包含 `main.js` 和 `preload.js` 两个文件，**完全缺失**：
1. `dist/` — Vite 构建产物（index.html + JS/CSS assets）
2. `node_modules/` — 运行时依赖（chokidar、@lydell/node-pty 等）

主进程启动时 `require("chokidar")` 和 `require("@lydell/node-pty")` 失败，进程崩溃。由于 `BrowserWindow` 设置了 `show: false`（等 `ready-to-show` 事件），窗口永远不会出现，用户看不到任何错误信息。

### 修复

```bash
cd D:\ClaudeProjectFolder\claudeforge
npm run build                    # tsc + vite build → 生成 dist/ + dist-electron/
npx electron-builder --win --dir # 重新打包 → app.asar 从 24KB → 110MB
```

### 预防措施

每次修改源码后必须按顺序执行：
1. `npm run build` — 重新构建 dist/ 和 dist-electron/
2. `npx electron-builder --win --dir` — 重新打包到 release/win-unpacked/

两者缺一不可，顺序不能颠倒。参见教训 #16-17。

---

## 第十轮：4项Bug修复 + 3项功能增强 + 启动性能优化（2026-07-07）

### 背景

用户测试反馈8个问题和需求，涉及对话管理、Token统计、主题系统、布局持久化、MCP配置、浏览器工具和启动速度。

---

### Bug 1：对话列表过滤空对话

**问题**：点击对话进入明细后，没有内容的对话也展示在列表中，进入后只显示"暂无消息内容"。

**根因**：
1. `claude-tools.ipc.ts` 的 `claude:conversations-list` handler 对所有 `history.jsonl` 中的 sessionId 都生成了对话条目，默认 `messageCount = entryCount * 2`（估算值），不检查实际消息文件是否存在或有内容
2. 前端 `ConversationManager.tsx` 没有防御性过滤

**修复**：
- `src/main/ipc/claude-tools.ipc.ts`：`messageCount` 默认改为 `0`，检查 `.jsonl` 消息文件是否存在且非空；消息文件不存在/为空时 `continue` 跳过该对话
- `src/renderer/components/tools/ConversationManager.tsx`：列表渲染添加 `.filter(c => c.messageCount > 0)` 防御；空消息详情添加"← 返回列表"按钮

---

### Bug 2：DeepSeek v4 Pro Token 统计不准

**问题**：对话明细底部的用量统计显示 DeepSeek v4 Pro 上下文窗口为 128K，实际模型上下文为 1M（1,000,000）tokens，进度条展示错误。

**根因**：`ConversationManager.tsx` 第 10 行 `MODEL_CONTEXT` 映射中 `'deepseek-v4-pro': 128000`，且 `getContextWindow` 函数使用 `Object.entries` 遍历（未按长度排序），可能导致 `deepseek-v4` 优先匹配到 `deepseek-v4-pro`。

**修复**：
- `MODEL_CONTEXT` 更新：`'deepseek-v4-pro': 1000000`，`gpt-4-turbo` 移到 `gpt-4` 前面
- `getContextWindow` 重写：按 key 长度降序排序后再匹配，确保长键优先

---

### Bug 3：主题配色手动修改后切换主题异常

**问题**：在 ThemeManager 中手动修改颜色后，切换内置主题出现样式冲突（CSS 变量残留）。

**根因**：**两个 bug 叠加**：
1. `useThemeStore.ts` 的 `applyTheme()` 切换到内置主题时只设置 `data-theme` 属性，不清除 `previewColors()`/`applyColors()` 遗留的内联 `style.setProperty()` 值。内联样式优先级高于 CSS `[data-theme]` 选择器
2. `ThemeManager.tsx` 的 `selectTheme()` 对内置主题调用 `store.getCurrentColors()`，返回的是 `store.current`（上次应用的主题）颜色而非新选中的主题 ID 颜色

**修复**：
- `useThemeStore.ts`：新增 `clearInlineColors()` 函数（移除 `:root` 上所有 `--*` 内联样式属性），在 `applyTheme()` 内置主题分支中调用
- `ThemeManager.tsx`：`selectTheme()` 内置主题分支改为直接从 `BUILT_IN_THEMES[id]` 加载颜色（而非 `store.getCurrentColors()`），并先调用 `clearInlineColors()`
- 导出 `BUILT_IN_THEMES`、`getColorsForTheme`、`clearInlineColors` 供外部使用
- Store 接口新增 `getBuiltInColors(id): ThemeColors` 方法

---

### Bug 4：内置主题缺少恢复默认按钮

**问题**：系统预制主题进入自定义界面时没有恢复默认的选项。

**修复**（`src/renderer/components/theme/ThemeManager.tsx`）：
- 新增 `handleRestoreDefaults()` 函数：调用 `clearInlineColors()` + 设置 `data-theme` + 更新编辑器颜色为内置默认值 + 调用 `setTheme()` 应用
- 在标题栏"应用"按钮左侧新增"恢复默认"按钮（仅 `isBuiltIn` 时显示），点击后自动恢复出厂配色并应用

---

### 功能 5：布局状态完整持久化

**描述**：记录上一次关闭前的完整布局（面板可见性、面板顺序、面板宽度、布局模式、底部高度），下次打开自动恢复。

**现状**：之前只有 `leftWidth`/`centerWidth`/`rightWidth` 三个宽度被保存到 session。

**修复**（3 个文件）：

1. `src/renderer/services/sessionManager.ts`：
   - `SessionData` 接口版本从 1 升级到 2
   - 新增 `layoutState` 可选字段（包含全部 8 个 `show*` 布尔值、`layoutMode`、`panelOrder`、`panelWidths`、`bottomHeight`、`browserWidth`）
   - `collectSessionData()` 新增 `layoutState` 参数
   - `loadSession()` 接受 v1/v2 版本（`data.version < 1 || data.version > 2` 时拒绝）
   - version 字段改为 `number` 类型（兼容 v1→v2 迁移）

2. `src/renderer/AppMain.tsx`：
   - `handleBeforeUnload`：从 `useLayoutStore.getState()` 收集完整 layoutState 并传入 `collectSessionData`
   - session 恢复：读取 `data.layoutState` 后批量设置所有面板可见性、layoutMode、panelOrder、panelWidths、bottomHeight、browserWidth

3. `src/renderer/stores/useLayoutStore.ts`：
   - 接口新增 `setLayoutMode(mode: LayoutMode): void`
   - 实现：`setLayoutMode: (mode) => set({ layoutMode: mode })`

---

### 功能 6：MCP 配置 JSON 编辑器重新设计

**描述**：MCP 配置（`mcp.json`）支持双模式编辑——表单模式（快速添加）和 JSON 模式（直接编辑原始 JSON）。

**问题**：之前的 McpConfigTool 只有表单模式（name/command/args 字段），无法编辑 `env`、`cwd`、`disabled`、`type` 等高级字段。

**修复**（`src/renderer/components/tools/McpConfigTool.tsx` 完全重写）：
- **双模式设计**：
  - JSON 编辑模式（`<textarea>` + monospace 字体 + JSON 解析验证）：适合高级用户，直接编辑原始 JSON
  - 表单模式（保留）：适合快速添加简单服务器
- 标题栏：编辑按钮（✎ 表单模式）和 JSON 按钮（{ } JSON 模式）
- JSON 验证：保存前 `JSON.parse()` 验证 + 对象类型检查，错误时红色提示
- 服务器列表：非 JSON 编辑模式时显示解析后的列表（名称、命令、参数、环境变量数）

---

### 功能 7：浏览器工具收藏夹 + 首页配置

**描述**：给 BrowserTool 增加完整的书签系统和首页配置功能。

**修复**（`src/renderer/components/tools/BrowserTool.tsx` 完全重写）：

新增功能：
1. **收藏夹星标按钮**（★）：工具栏中，点击收藏当前页面，已收藏时高亮黄色
2. **书签下拉菜单**（🔖）：列出所有书签（名称 + URL），点击导航，悬停显示删除按钮
3. **首页配置**（🏠）：书签菜单中"设置首页"链接，输入 URL 保存到 localStorage
4. **主页按钮**：设置首页后工具栏显示主页按钮，点击快速导航
5. **自动导航首页**：`dom-ready` 后首次加载时自动导航到首页
6. **加载指示器**：页面加载时刷新按钮旋转动画
7. **文档外点击关闭**：下拉菜单点击外部自动关闭

数据存储：
- `localStorage` key `mlx-browser-bookmarks`：书签数组（name, url, addedAt）
- `localStorage` key `mlx-browser-homepage`：首页 URL 字符串

---

### 优化 8：启动性能提速

**描述**：软件打开感觉慢，优化启动速度不影响原有功能。

**分析**：
- 主进程：所有 7 个 IPC handler 在 `whenReady` 中同步注册，file-indexer service 在模块顶层 import
- 渲染进程：`initPluginSystem()` 和 file indexer 在 mount 时立即执行

**修复**（3 个文件）：

1. `src/main/main.ts`：
   - 非关键 IPC（plantuml、file-indexer、claude-tools）从静态 import 改为动态 `import()`，在 `ready-to-show` 后延迟注册
   - 关键 IPC（terminal、filesystem、dialog、window）保持立即注册
   - `before-quit` 的 `getFileIndexer()` 改为动态 import（避免启动时加载 file-indexer 服务模块）
   - 移除顶层 `import { ipcMain } from 'electron'`（不再使用）

2. `src/renderer/AppMain.tsx`：
   - `initPluginSystem()` 延迟 500ms 执行（`setTimeout(() => initPluginSystem(), 500)`）
   - 文件索引器启动延迟 2 秒（`setTimeout(() => fileIndexer.start(), 2000)`）
   - cleanup 中增加 `clearTimeout(pluginTimer)`

3. `vite.config.ts`：
   - 新增 `manualChunks` 配置：`vendor-react`（react/react-dom）、`vendor-codemirror`（codemirror 相关）、`vendor-motion`（framer-motion）
   - 改善缓存命中率，加快二次启动

---

### 经验教训总结（第十轮新增）

38. **Claude 对话列表需要验证消息文件存在性** — `history.jsonl` 中有 sessionId 不代表有实际对话内容。消息文件（`projects/<dir>/<id>.jsonl`）可能不存在或为空，必须先检查再展示
39. **模型上下文窗口映射需要长键优先匹配** — `deepseek-v4-pro` 包含 `deepseek-v4` 子串，不排序时可能错误匹配到短键。使用 `Object.entries().sort((a,b) => b.length - a.length)` 确保精确匹配
40. **CSS 内联样式会永久覆盖 data-theme 选择器** — `style.setProperty()` 的值不会因为 `data-theme` 属性变化而自动清除。切换内置主题前必须调用 `style.removeProperty()` 清理所有内联样式变量
41. **ThemeManager 颜色加载不应依赖 store.current** — 用户选中的主题 ID 和 store 中当前应用的主题 ID 是不同概念。编辑器应直接从主题常量或 ID 解析颜色，而非从 `getCurrentColors()` 间接获取
42. **布局持久化需要覆盖全部状态** — 之前只保存 3 个宽度导致用户每次启动都要重新配置面板可见性和排列。SessionData 应完整序列化所有 UI 状态（visibility、order、widths、mode、heights）
43. **MCP 配置本质上是一个 JSON 文件** — 表单模式适合快速操作，但应同时提供 JSON 编辑器以便用户配置 env/cwd/headers 等高级字段。双模式（表单 + JSON）兼顾简单性和灵活性
44. **浏览器工具需要持久化用户数据** — 书签和首页是浏览器最基本的功能，使用 localStorage 存储即可满足离线使用需求，无需 IPC
45. **启动优化关键是延迟非关键路径** — 核心 IPC（终端、文件系统）必须立即注册，非核心 IPC（plantuml、claude-tools）可在窗口显示后延迟加载。插件系统和文件索引器也应延迟初始化
46. **动态 import() 减少主进程冷启动模块图大小** — 将 3 个非关键 IPC 模块从静态 import 改为动态 import，主进程 main.js 从包含所有依赖变为仅包含 4 个核心 IPC，体积显著减小

---

## 全部 10 轮修改统计（更新）

| 轮次 | 日期 | 修改数 | 新建文件 | 修改文件 |
|------|------|--------|---------|---------|
| 第一轮 | 07-03 10:00 | 11项 | 3 | 14 |
| 第二轮 | 07-03 11:00 | 4项 | 0 | 8 |
| 第三轮 | 07-03 11:15 | 6项 | 1 | 6 |
| 第四轮 | 07-03 12:00 | 4项 | 7(GitHub文档) | 3 |
| 第五轮 | 07-03 12:13 | 3项 | 0 | 5 |
| 第六轮 | 07-05 14:00 | 布局拖拽+拖拽排序+磨砂玻璃 | 2 | 12 |
| 第七轮 | 07-05 17:00 | 6项细节打磨+终端焦点 | 0 | 6 |
| 第八轮 | 07-06 22:00 | 7项修复+Claude工具子系统 | 11 | 12 |
| 第八轮补充 | 07-06 23:00 | 对话框分组+面板resizer+最大化状态+纯文本+Token统计 | 0 | 5 |
| 第九轮 | 07-07 00:00 | 双击exe无法打开修复（app.asar缺失） | 0 | 0 |
| **第十轮** | **07-07 10:00** | **8项修复+增强+优化** | **0** | **10** |
| **合计** | | **69+项** | **24文件** | **50+文件** |

### 第十轮修改文件清单

| 文件 | 改动内容 |
|------|---------|
| `src/renderer/components/tools/ConversationManager.tsx` | MODEL_CONTEXT更新1M + getContextWindow长键优先 + 空对话过滤 + 空消息回退按钮 |
| `src/main/ipc/claude-tools.ipc.ts` | 对话列表过滤空消息文件（messageCount=0时跳过） |
| `src/renderer/stores/useThemeStore.ts` | clearInlineColors() + applyTheme内置分支清除 + getBuiltInColors + 导出BUILT_IN_THEMES |
| `src/renderer/components/theme/ThemeManager.tsx` | selectTheme修复 + 恢复默认按钮 + handleRestoreDefaults |
| `src/renderer/services/sessionManager.ts` | SessionData v2 + layoutState完整布局持久化 |
| `src/renderer/AppMain.tsx` | 布局保存/恢复 + 延迟initPluginSystem(500ms) + 延迟fileIndexer(2s) |
| `src/renderer/stores/useLayoutStore.ts` | 新增setLayoutMode方法 |
| `src/renderer/components/tools/McpConfigTool.tsx` | 完全重写：双模式JSON编辑器（JSON模式+表单模式） |
| `src/renderer/components/tools/BrowserTool.tsx` | 完全重写：收藏夹+首页+书签下拉+加载指示器 |
| `src/main/main.ts` | 非关键IPC动态import延迟注册 + before-quit延迟加载fileIndexer |
| `vite.config.ts` | manualChunks分包优化（vendor-react/codemirror/motion） |

---

## 待修复：Claude 启动 ASCII 小人展示不全（2026-07-10）

### 现象

MLX 内嵌终端启动 Claude CLI 时，欢迎 splash ASCII art 只显示半个头，被截断。

### 根因

`terminal-manager.ts` 中 `claude` 的自动启动用的是固定 `setTimeout(800ms)`，与前端 xterm.js 的异步 `fitAddon.fit()` + PTY resize 存在竞态条件：

1. PTY 以 `cols: 80` 创建（`TerminalPanel.tsx:45` 硬编码）
2. 800ms 后 `pty.write('claude\r')` 执行
3. Claude 启动时探测终端尺寸，按当时的 cols 渲染 ASCII art
4. 但 xterm.js 的 fit 依赖 `document.fonts.ready`（异步），实际 resize 可能发生在 Claude 启动之后
5. 即使后续 PTY 被 resize，已输出的 ASCII art 不会重绘

### 修复方案

#### 文件 1: `src/main/services/terminal-manager.ts`

**思路**：把 `claude` 的自动启动从"固定延时"改为"等待前端完成第一次 resize"，确保 Claude 启动时终端尺寸已就绪。

```typescript
export class TerminalManager {
  private sessions = new Map<string, TerminalSession>();
  private pendingClaudeLaunch = new Set<string>();  // ← 新增：待启动 Claude 的 session
  private claudeTimers = new Map<string, NodeJS.Timeout>();  // ← 新增：兜底定时器

  create(options: { cwd: string; cols?: number; rows?: number }): string {
    const id = this.genId();
    // ... (spawn 逻辑不变) ...

    // 标记待启动 Claude（不再直接 setTimeout 800ms 启动）
    this.pendingClaudeLaunch.add(id);

    // 兜底定时器：如果 2 秒内前端还没 resize，则按默认尺寸启动 Claude
    const fallbackTimer = setTimeout(() => {
      if (this.pendingClaudeLaunch.has(id)) {
        this.pendingClaudeLaunch.delete(id);
        pty.write('claude\r');
      }
    }, 2000);
    this.claudeTimers.set(id, fallbackTimer);

    return id;
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.pty.resize(cols, rows);
      
      // 第一次 resize 时启动 Claude（此时终端尺寸已就绪）
      if (this.pendingClaudeLaunch.has(sessionId)) {
        this.pendingClaudeLaunch.delete(sessionId);
        const timer = this.claudeTimers.get(sessionId);
        if (timer) { clearTimeout(timer); this.claudeTimers.delete(sessionId); }
        session.pty.write('claude\r');
      }
    }
  }

  kill(sessionId: string): void {
    // ... 现有逻辑不变 ...
    // 清理
    this.pendingClaudeLaunch.delete(sessionId);
    const timer = this.claudeTimers.get(sessionId);
    if (timer) { clearTimeout(timer); this.claudeTimers.delete(sessionId); }
  }
}
```

#### 文件 2: `src/renderer/components/terminal/TerminalPanel.tsx`

**改动**：将初始 `cols` 从 80 改为 120，给 PTY 更宽的默认列数（更接近实际窗口宽度），减少 resize 前后的尺寸跳变。

```typescript
// 第 45 行，改前：
cols: 80,
// 改后：
cols: 120,
```

### 为什么这样修

- **根本解决**：Claude 在第一次 resize 之后才启动，它探测到的终端尺寸 = xterm.js fit 后的实际尺寸，ASCII art 按正确宽度渲染
- **有兜底**：2 秒超时确保即使 resize 因某种原因没触发，Claude 仍会启动
- **不破坏其他功能**：后续 resize 行为不变（Claude 和其他命令都能响应终端尺寸变化）
- **影响范围极小**：只改 2 个文件，合计约 15 行代码

---

## 第十一轮：双终端自动启动（Opencode + Claude）（2026-07-13）

### 背景

用户要求首次打开软件或通过 Ctrl+Shift+P 切换项目后，终端自动开启两个会话：一个执行 `opencode`（标签 "Opencode"），另一个执行 `claude`（标签 "Claude"）。之前只自动创建一个 Claude 终端。

### 实施方案

#### 文件 1: `src/main/services/terminal-manager.ts`
- `create()` options 新增可选 `command?: string` 参数
- 如果传了 `command`，延时后执行对应命令；否则默认执行 `claude`（向后兼容）

#### 文件 2: `src/renderer/types/electron.d.ts`
- `terminal.create` options 类型新增 `command?: string`

#### 文件 3: `src/renderer/stores/useTerminalStore.ts`
- 新增 `resetAll()` 方法：清空 tabs、重置 activeId 为 null、counter 回 1

#### 文件 4: `src/renderer/stores/useProjectStore.ts`
- 新增 `switchTrigger: number` 和 `triggerSwitch()` 方法
- `triggerSwitch()` 递增计数器，TerminalPanel 监听此值检测项目切换

#### 文件 5: `src/renderer/components/terminal/TerminalPanel.tsx`（核心改动）
- `createTerminal` 改为接受可选 `{ command?, label? }` 参数
- 新增 `initDualTerminals()`：依次创建 Opencode（command: 'opencode'）和 Claude（command: 'claude'）两个终端
- 首次加载 effect：调用 `initDualTerminals()` 创建双终端（而非单个）
- 新增 effect 监听 `switchTrigger`：项目切换时 → kill 所有旧 PTY → `resetAll()` → 自动触发双终端重建
- 手动点 + 新建终端：label 为 `终端 ${counter}`（counter 从 3 开始，前两个被 Opencode/Claude 占用）

#### 文件 6: `src/renderer/AppMain.tsx`
- `handleSwitchProject` 末尾调用 `useProjectStore.getState().triggerSwitch()` 触发终端重建

### 关键设计决策

1. **项目切换通过 store 信号驱动**：`triggerSwitch()` 递增 switchTrigger 计数器 → TerminalPanel 监听到变化 → kill 旧会话 + resetAll → tabs.length 变为 0 → 自动创建 effect 重新触发 → 创建双终端。避免了 TerminalPanel 和 AppMain 之间的直接耦合。

2. **向后兼容**：不传 `command` 参数时行为与之前完全一致（默认执行 `claude`）。手动新建的终端也走默认 `claude` 命令。

3. **counter 初始值保持 1**：`resetAll()` 将 counter 重置为 1，首次创建 Opencode（counter=1→2）和 Claude（counter=2→3），后续手动新建标签从 "终端 3" 开始。

### 验证方式

1. **首次启动**：删除 localStorage 中 mlx-project 数据 → 启动应用 → 选择项目目录 → 终端自动出现 "Opencode" 和 "Claude" 两个标签页
2. **项目切换**：Ctrl+Shift+P → 选择新目录 → 旧终端会话被杀掉 → 两个新标签页 "Opencode" + "Claude"
3. **手动新建**：点击 + 按钮 → 标签为 "终端 3"，默认执行 claude
4. **向后兼容**：不传 command 参数 → 行为与之前完全一致

---

## 第十二轮：终端 "+" 按钮弹出命令选择对话框（2026-07-13）

### 背景

之前点击终端标签栏的 "+" 按钮直接创建一个默认执行 `claude` 的新终端会话（标签为"终端 N"）。用户希望点击 "+" 时弹出一个选择界面，可以从 Claude、Opencode、或自定义命令中选择要启动的命令。

### 实施方案

#### 文件 1: `src/renderer/components/terminal/NewTerminalDialog.tsx`（新建）

命令选择弹窗组件，遵循项目已有的 modal 模式（`FavoritesButton.tsx` 的 `fixed inset-0 z-50 bg-black/50` 遮罩 + `glass-panel` 卡片）：

- **布局**：全屏半透明遮罩 + 居中 glass-panel 卡片（min-w-[320px], max-w-[400px]）
- **标题**："新建终端会话" + VscTerminal 图标 + 关闭按钮（VscClose）
- **三个选项**（radio-style 按钮，选中时蓝色边框 + accent 背景）：
  1. **Claude** — 启动 `claude`，标签 "Claude"
  2. **Opencode** — 启动 `opencode`，标签 "Opencode"
  3. **自定义指令** — 展开文本输入框，用户自行输入命令，标签使用输入的命令名
- **交互**：
  - 点击选项切换选中状态（radio button 填充动画）
  - 选择"自定义指令"时自动聚焦输入框
  - Enter 键确认、Escape 键取消
  - 点击遮罩层外部 = 取消
  - 自定义指令未输入内容时"创建终端"按钮 disabled
- **样式**：全部使用 Tailwind CSS 变量 class（`bg-bg-raised`, `text-text-primary`, `border-border-subtle` 等），不使用透明度修饰符（避免 JIT 引擎生成无效 CSS）

#### 文件 2: `src/renderer/components/terminal/TerminalPanel.tsx`（修改）

- `useState` 新增导入
- 新增 `showNewTermDialog` state
- 新增 `handleNewTerminalConfirm(command, label)`：调用 `createTerminal({ command, label })` 后关闭对话框
- `TerminalTabs` 的 `onAdd` 从直接调 `createTerminal` 改为 `() => setShowNewTermDialog(true)`
- 条件渲染 `<NewTerminalDialog>`（`showNewTermDialog &&`）

### 关键设计决策

1. **不修改 terminal-manager.ts / IPC / preload**：这些层已经支持 `command` 参数（默认 `claude`），向后兼容。

2. **双终端自动启动逻辑完全不受影响**：首次加载和项目切换时的 `initDualTerminals()`（Opencode + Claude）保持不变。

3. **对话框样式严格遵循现有 modal 模式**：使用 `FavoritesButton.tsx` 的遮罩+glass-panel 范式，确保主题切换时配色正常跟随。

4. **自定义命令的标签使用命令名本身**：如输入 `python`，标签即为 "python"，直观简洁。

### 验证方式

1. 启动应用 → 双终端自动创建（Opencode + Claude）→ 正常
2. 点击 "+" 按钮 → 弹出命令选择对话框，默认选中 Claude
3. 选择 "Claude" → 确认 → 新终端标签 "Claude"，执行 `claude`
4. 选择 "Opencode" → 确认 → 新终端标签 "Opencode"，执行 `opencode`
5. 选择 "自定义指令" → 输入 `python` → 确认 → 新终端标签 "python"，执行 `python`
6. 选择 "自定义指令" 但未输入 → "创建终端"按钮 disabled
7. 点击遮罩层或取消按钮 → 对话框关闭，无新终端创建
8. 主题切换后对话框配色正常跟随

### 变更文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/renderer/components/terminal/NewTerminalDialog.tsx` | 新建 | 命令选择弹窗组件（~160行） |
| `src/renderer/components/terminal/TerminalPanel.tsx` | 修改 | 集成对话框，onAdd 改为打开弹窗 |

---

## 全部 12 轮修改统计（更新）

| 轮次 | 日期 | 修改数 | 新建文件 | 修改文件 |
|------|------|--------|---------|---------|
| 第一轮 | 07-03 10:00 | 11项 | 3 | 14 |
| 第二轮 | 07-03 11:00 | 4项 | 0 | 8 |
| 第三轮 | 07-03 11:15 | 6项 | 1 | 6 |
| 第四轮 | 07-03 12:00 | 4项 | 7(GitHub文档) | 3 |
| 第五轮 | 07-03 12:13 | 3项 | 0 | 5 |
| 第六轮 | 07-05 14:00 | 布局拖拽+拖拽排序+磨砂玻璃 | 2 | 12 |
| 第七轮 | 07-05 17:00 | 6项细节打磨+终端焦点 | 0 | 6 |
| 第八轮 | 07-06 22:00 | 7项修复+Claude工具子系统 | 11 | 12 |
| 第八轮补充 | 07-06 23:00 | 对话框分组+面板resizer+最大化状态+纯文本+Token统计 | 0 | 5 |
| 第九轮 | 07-07 00:00 | 双击exe无法打开修复（app.asar缺失） | 0 | 0 |
| 第十轮 | 07-07 10:00 | 8项修复+增强+优化 | 0 | 10 |
| 第十一轮 | 07-13 00:00 | 双终端自动启动（Opencode+Claude） | 0 | 6 |
| **第十二轮** | **07-13 14:00** | **终端"+"弹出命令选择对话框** | **1** | **1** |
| **第十三轮** | **07-14 17:00** | **终端复制粘贴 + QuickTools修复 + 文件浏览器自动刷新** | **0** | **10** |
| **合计** | | **74+项** | **25文件** | **61+文件** |

---

## 第十三轮：终端复制粘贴 + QuickTools按钮丢失修复 + 文件浏览器自动刷新（2026-07-14）

### 功能 16：终端 Ctrl+C/V 复制粘贴 + 右键菜单

**背景**：xterm.js 终端将所有键盘输入直接发给 PTY，Ctrl+C 发送 SIGINT、Ctrl+V 发原始字节给 shell。用户无法使用 Windows 原生复制粘贴。

**实现**：
- **XTerm.tsx**：使用 `attachCustomKeyEventHandler` 在 KeyboardEvent 级别拦截 Ctrl+C/V
  - Ctrl+C：有选中文本 → `navigator.clipboard.writeText()` 复制到剪贴板 + `terminal.clearSelection()`，返回 false 阻止发送 `\x03`
  - Ctrl+C：无选中 → 放行正常 SIGINT
  - Ctrl+V / Ctrl+Shift+V：`navigator.clipboard.readText()` → `terminal.paste(text)` 显示并转发到 PTY
  - `useImperativeHandle` 新增 `hasSelection()`、`copySelection()`、`pasteClipboard()` 方法供右键菜单调用
- **TerminalPanel.tsx**：新增右键上下文菜单（复制/粘贴两个按钮），使用 `VscCopy` 图标

### Bug 9：QuickTools 切换布局后丢失按钮

**根因**：`applyThreeColumnVertical()` 和 `applyThreeColumnHorizontal()` 只设置了 4 个主面板可见性，未重置 `showConversations`/`showSkills`/`showMcpConfig`/`showBrowser`。切换布局后这些面板的 state 残留为 true，QuickTools 不显示恢复按钮，但预设布局的硬编码渲染不包含它们。

**修复**（2 个文件）：
- `useLayoutStore.ts`：两个 `applyXxx` 函数显式重置全部 8 个面板可见性
- `QuickTools.tsx`：点击按钮时若处于非 free 模式，自动切换到 free 模式确保面板能渲染

### Bug 10：文件浏览器不自动刷新

**根因**：`FileTree.loadDir()` 仅在 rootPath 变化或用户手动操作后调用。外部工具/CLI 生成新文件时无通知机制。

**修复**（8 个文件）：
- `ipc-channels.ts`：新增 `FS_START_WATCH`
- `filesystem.ipc.ts`：chokidar 监听 + 300ms 防抖 + 发送 `FS_ON_CHANGE` 事件。接受 `mainWindow` 参数
- `main.ts`：`registerFilesystemIpc(mainWindow!)`
- `preload.ts`：暴露 `fs.startWatch` 和 `fs.onChange`
- `electron.d.ts`：追加类型声明
- `useFileStore.ts`：新增 `refreshTrigger` + `triggerRefresh()`
- `FileTree.tsx`：订阅 `fs.onChange` → 500ms debounce 后 `loadDir()`
- `FileBrowser.tsx`：标题栏新增 VscRefresh 刷新按钮

### 修改文件清单

| 文件 | 改动内容 |
|------|---------|
| `src/renderer/components/terminal/XTerm.tsx` | Ctrl+C/V拦截 + onSelectionChange + XTermHandle扩展 + cleanup |
| `src/renderer/components/terminal/TerminalPanel.tsx` | 右键上下文菜单（复制/粘贴） |
| `src/renderer/stores/useLayoutStore.ts` | applyThreeColumnVertical/Horizontal重置全部8个面板 |
| `src/renderer/components/layout/QuickTools.tsx` | 点击按钮自动切换到free模式 |
| `src/shared/ipc-channels.ts` | 新增FS_START_WATCH |
| `src/main/ipc/filesystem.ipc.ts` | chokidar文件监听 + 接受mainWindow参数 |
| `src/main/main.ts` | registerFilesystemIpc传入mainWindow |
| `src/preload/preload.ts` | 暴露fs.startWatch + fs.onChange |
| `src/renderer/types/electron.d.ts` | fs API类型扩展 |
| `src/renderer/stores/useFileStore.ts` | refreshTrigger + triggerRefresh |
| `src/renderer/components/filesystem/FileTree.tsx` | fs.onChange订阅自动刷 |
| `src/renderer/components/filesystem/FileBrowser.tsx` | 刷新按钮 |

### 经验教训总结（第十三轮新增）

47. **xterm.js `attachCustomKeyEventHandler` 在 v5.3 中返回 void** — 与文档所述的 `IDisposable` 不同，实际返回 `void`，不能调用 `.dispose()`。生命周期由 `terminal.dispose()` 统一管理，通过 `disposed` 闭包标志位控制回调有效性。
48. **`chokidar.FSWatcher` 不能直接用作类型标注** — TypeScript 不识别 `chokidar` 命名空间类型。改用 `ReturnType<typeof chokidar.watch>` 获取正确的返回类型。
49. **预设布局函数必须重置全部面板状态** — `applyThreeColumnVertical/Horizontal` 只修改 4 个主面板可见性，不重置 4 个辅助面板（conversations/skills/mcpConfig/browser）会导致 state 残留：面板不可见但 `showXxx=true`，QuickTools 不显示恢复按钮，用户感知为"按钮丢失"。
50. **文件监听需要双层防抖** — 文件生成/删除时可能触发多个 chokidar 事件（add + addDir + change 等），主进程 300ms 防抖 + 渲染进程 500ms 防抖防止 loadDir 被高频调用。chokidar 的 `ignoreInitial: true` 确保启动时不触发刷新。
51. **`navigator.clipboard` 在 Electron 渲染进程可直接使用** — 无需通过 preload/IPC 桥接。Electron 渲染进程运行在 secure context 中，`readText()` 和 `writeText()` 可直接调用。这是最简单可靠的剪贴板方案。
52. **`terminal.paste(text)` 优于 `terminal.write(text)`** — `paste()` 同时显示文本并触发 `onData` 回调（自动转发到 PTY），`write()` 只显示不触发 onData。

---

## 第十四轮：大规模优化 + Opencode对话 + 内容搜索 + 提示词管理（2026-07-22）

### 背景

用户要求全面优化启动速度、修复终端复制粘贴、追加文件浏览器功能、扩展Opencode会话管理、跨文件内容搜索、快捷键帮助、最近项目，以及提示词管理工具。

### Bug 1：终端Ctrl+V双重粘贴 + Ctrl+C/V无效（xterm 5.3兼容性）

**根因**：xterm 5.3.0 中 `attachCustomKeyEventHandler` 的**返回值已被忽略**（返回类型从 `boolean` 改为 `void`）。之前的代码：
- Ctrl+C：有选中文本时 `return false`，但实际 `\x03` 仍然发送到 PTY → 既复制了文本又杀了进程
- Ctrl+V：自定义读剪贴板写PTY + `return true` → 由于 `preventDefault()` 缺失，浏览器原生粘贴也触发 → 双重粘贴

**修复**（`XTerm.tsx`）：
- 所有分支必须调用 `event.preventDefault()` + `event.stopPropagation()` 才能真正阻断 xterm 处理
- Ctrl+C：有选中 → `preventDefault()` + 复制到剪贴板 + 清除选中
- Ctrl+V：`preventDefault()` + `stopPropagation()` + 自定义读剪贴板写 PTY（`navigator.clipboard.readText()`）

### Bug 2：最大化窗口后终端行列错乱

**根因**：窗口最大化时 Windows 动画连续触发 `ResizeObserver`，每个中间帧同步执行 `fitAddon.fit()` 读到错误尺寸 → PTY 被 resize 到错误行列数。

**修复**（`XTerm.tsx`）：
- ResizeObserver 回调外包 `requestAnimationFrame`（确保布局已提交）
- `cancelAnimationFrame` 防抖（连续尺寸变化只取最后一次）
- 避免最大化动画期间疯狂 resize PTY

### Bug 3：文件浏览器空白处右键无效

**根因**：Framer Motion `motion.div` 使用 `animate={{ height: 'auto' }}` — Framer Motion 不支持动画到 `auto`，实际高度永远为 0，形成一个零高度不可见层拦截了鼠标事件。

**修复**（`FileTree.tsx`）：
- `height: 'auto'` 动画改为仅 `opacity` 动画
- 高度由 CSS 自然控制

### Bug 4：EverythingSearch 右键缺少重命名

**修复**（`EverythingSearch.tsx`）：
- 右键菜单追加「重命名」选项，prompt 输入新名称后调 IPC 改名 + 刷新搜索结果

### Bug 5：FileTree 路径归一化 + 慢双击改名

**修复**（`FileTree.tsx`）：
- `handleRenameCommit` 中统一用 `replace(/\\/g, '/')` 归一化路径后再计算 parent
- 新增 `lastClickRef`，同一文件间隔 300ms~3s 的第二次单击进入重命名模式（Windows 风格慢双击）
- <300ms 的快双击仍然打开文件，与现有 `handleDoubleClick` 不冲突

### Bug 6：Opencode 对话管理无内容（4个错误）

| 错误 | 位置 | 修复 |
|------|------|------|
| 查错表 `session_message`（空） | `claude-tools.ipc.ts:403` | → 改查 V1 `message` 表 |
| 字段名 `time_updated`/`time_created` | `claude-tools.ipc.ts:390` | → 改为 `updated`/`created` |
| 解析 `data.type` + `data.content?.text` | `claude-tools.ipc.ts:409-418` | → 改为 `data.role` + `data.content` |
| 找不到 opencode 路径 | `claude-tools.ipc.ts:362` | → 追加 Chocolatey 路径 `C:\ProgramData\chocolatey\bin\opencode.exe` |

### Bug 7：Opencode 对话加载极慢（N+1查询）

**根因**：`OPENCODE_CONVERSATIONS_LIST` handler 对每个 session**顺序执行 `runOpencode(['db', 'SELECT COUNT(*)...'])`**，200个 session = 201次 CLI 进程启动。

**修复**（`claude-tools.ipc.ts`）：
- 改用单次批量查询替代 N+1：
```sql
SELECT session_id, COUNT(*) as c FROM message GROUP BY session_id
```
- 一次 CLI 调用获取所有 session 的消息数，时间从 ~120秒降到 ~500ms

### Bug 8：所有 Opencode session 只显示 1 条消息

**根因**：批量查询也解决了此问题。之前 N+1 的 `COUNT(*)` JSON 解析失败被 `catch {}` 静默吞掉。

### 新功能：启动只创建 opencode，Claude 延迟 3s

**修改**（`TerminalPanel.tsx`）：
```typescript
await createTerminal({ command: 'opencode', label: 'Opencode' });
setTimeout(() => createTerminal({ command: 'claude', label: 'Claude' }), 3000);
```

### 新功能：文件索引延迟 10s 启动

**修改**（`AppMain.tsx`）：2000 → 10000

### 新功能：非首屏面板 React.lazy 化（性能优化）

**修改**（`AppMain.tsx`）：
- 将 `ConversationManager`、`SkillManager`、`McpConfigTool`、`BrowserTool`、`EverythingSearch` 从静态 import 改为 `React.lazy()`
- 每个面板单独的异步 chunk，首屏 JS 减少 ~150KB

**验证**：打包后看到独立 chunk 文件：
```
assets/ConversationManager-xxx.js   10.50 kB
assets/SkillManager-xxx.js           3.30 kB
assets/McpConfigTool-xxx.js          7.64 kB
assets/BrowserTool-xxx.js            7.43 kB
assets/EverythingSearch-xxx.js       9.79 kB
assets/ContentSearch-xxx.js          4.35 kB
assets/PromptManager-xxx.js         10.32 kB
```

### 新功能：跨文件内容搜索（Ctrl+Shift+F）

**架构**：
- IPC handler (`filesystem.ipc.ts`)：优先使用 `rg` (ripgrep)，不可用时回退到 Node.js 逐文件搜索
- UI 组件 (`ContentSearch.tsx`)：类似 EverythingSearch 的搜索面板，搜索结果按文件分组，点击展开行级预览，点击行跳转到编辑器
- 快捷键 `Ctrl+Shift+F` 切换面板

**支持的文件类型**：`.ts/.tsx/.js/.jsx/.py/.java/.rs/.go/.c/.cpp/.html/.css/.json/.xml/.yaml/.yml/.md/.txt/.sh/.bat/.ps1/.sql/.env` 等 50+ 种

### 新功能：快捷键帮助面板（Ctrl+Shift+/）

**组件**（`ShortcutHelp.tsx`）：
- 模态弹窗，按分类列出所有快捷键（文件、编辑、视图、终端、项目 5 组）
- `Escape` 关闭，点击遮罩关闭
- 入口：帮助菜单「快捷键」或 `Ctrl+Shift+/`

### 新功能：最近项目列表

**修改**（`FolderPicker.tsx` + `App.tsx`）：
- localStorage 存储最近 10 个项目路径
- 启动时 FolderPicker 下方显示最近项目列表，点击直接进入
- 选择新项目时自动记录

### 新功能：状态栏增强

**修改**（`AppShell.tsx`）：
- 显示当前 Git 分支（读取 `.git/HEAD`）
- 显示当前项目名称

### 新功能：对话导出 Markdown

**修改**（`ConversationManager.tsx`）：
- 对话详情页追加「导出」按钮
- 将消息拼接为 Markdown，浏览器下载 `.md` 文件

### 新功能：Opencode/Claude 对话页签切换

**修改**（`ConversationManager.tsx` + `useConversationStore.ts`）：
- 标题栏下方新增 Claude / Opencode 页签切换
- `useConversationStore` 新增 `tool` 字段和 `setTool()` 方法
- `loadConversations()` 根据当前 tab 调用不同的 IPC API
- `resumeConversation()` 自动分辨工具类型：
  - Claude → 返回 `claude --resume <id>`
  - Opencode → 返回 `opencode run --session <id>`

### 新功能：提示词管理工具（Ctrl+Shift+M）

**背景**：用户需要像对话管理一样管理提示词（.md 文件），支持目录层级、查看、编辑、新建、删除。

**架构设计**：
- **存储**：exe 同级 `prompts/` 目录，子目录=分类，.md 文件=提示词
- **IPC**：新增 `prompts.ipc.ts`，首次启动自动创建目录和 3 个示例提示词
- **Store**：`usePromptStore.ts` — 管理目录树、选中路径、编辑状态
- **UI**：`PromptManager.tsx` — 三级交互（list → detail → edit）

**三级交互**：
```
┌ list ──────────────────────┐
│ 📁 coding             ▸   │ ← 单击展开
│ 📄 Code Review.md         │ ← 单击进入 detail
├────────────────────────────┤
│ [+ 新建] [分组] [刷新]     │
└────────────────────────────┘

┌ detail ────────────────────┐
│ 💡 提示词 ←         [×]  │
│ # Code Review             │
│ 请审查以下代码...         │
├────────────────────────────┤
│ [✏ 编辑] [📋 复制] [🗑 删]│
└────────────────────────────┘

┌ edit ──────────────────────┐
│ ┌─────────────────────┐   │
│ │ # Code Review       │   │ ← textarea
│ │ ...                │   │
│ └─────────────────────┘   │
│ [💾 保存] [✕ 取消]        │
└────────────────────────────┘
```

**操作**：右键菜单（新建提示词/分组、重命名、删除）、底部工具栏、F2重命名/Delete删除快捷键。

**一致性**：与 ConversationManager 完全一致的交互模式——DraggablePanelHeader、CSS display:none 隐藏、Tailwind CSS 变量、右键 ContextMenu 组件、所有面板统一规范。

### 修改文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/main/main.ts` | 修改 | 注册prompts IPC |
| `src/main/ipc/prompts.ipc.ts` | **新建** | prompts目录初始化 + IPC handler |
| `src/main/ipc/filesystem.ipc.ts` | 修改 | + 跨文件内容搜索（rg + Node.js回退） |
| `src/main/ipc/claude-tools.ipc.ts` | 修改 | Opencode批量查询替代N+1 + 字段修复 + 路径修复 |
| `src/shared/ipc-channels.ts` | 修改 | + OPENCODE_* + CONTENT_SEARCH + PROMPTS_DIR |
| `src/preload/preload.ts` | 修改 | + opencodeTools + contentSearch + prompts API |
| `src/renderer/types/electron.d.ts` | 修改 | 类型声明扩展 |
| `src/renderer/AppMain.tsx` | 修改 | React.lazy 5面板 + ContentSearch + PromptManager + 快捷键 |
| `src/renderer/App.tsx` | 修改 | 最近项目保存 |
| `src/renderer/components/layout/AppShell.tsx` | 修改 | 快捷键帮助 + 提示词管理菜单 + 状态栏(Git/项目名) |
| `src/renderer/components/layout/ShortcutHelp.tsx` | **新建** | 快捷键帮助弹窗 |
| `src/renderer/components/layout/DraggablePanelHeader.tsx` | 修改 | PanelId追加'prompts' |
| `src/renderer/stores/useLayoutStore.ts` | 修改 | + showPrompts + showContentSearch 及其控制函数 |
| `src/renderer/stores/usePromptStore.ts` | **新建** | 提示词状态树 + CRUD |
| `src/renderer/stores/useConversationStore.ts` | **新建** | 支持claude/opencode双工具 |
| `src/renderer/components/terminal/XTerm.tsx` | 修改 | Ctrl+C/V加preventDefault + ResizeObserver加rAF防抖 |
| `src/renderer/components/terminal/TerminalPanel.tsx` | 修改 | 只启动opencode，claude延迟3s |
| `src/renderer/components/filesystem/FileTree.tsx` | 修改 | height:auto→opacity + 路径归一化 + 慢双击改名 |
| `src/renderer/components/filesystem/EverythingSearch.tsx` | 修改 | 右键追加重命名 |
| `src/renderer/components/filesystem/FileRow.tsx` | 不改 | — |
| `src/renderer/components/onboarding/FolderPicker.tsx` | 修改 | 最近项目列表 |
| `src/renderer/components/tools/ConversationManager.tsx` | 修改 | 工具页签切换 + 导出Markdown |
| `src/renderer/components/tools/PromptManager.tsx` | **新建** | 提示词管理（三级交互） |
| `src/renderer/components/search/ContentSearch.tsx` | **新建** | 跨文件内容搜索面板 |

### 经验教训总结（第十四轮新增）

53. **xterm 5.3.0 `attachCustomKeyEventHandler` 返回值被完全忽略** — 必须用 `event.preventDefault()` + `stopPropagation()` 才能阻断 xterm 处理键事件。返回 boolean 在 5.3.0 无效果。
54. **ResizeObserver 回调必须包 `requestAnimationFrame`** — 最大化/还原窗口动画期间每帧触发回调，直接 `fitAddon.fit()` 读到中间态 0 尺寸导致 PTY 行列错乱。rAF 确保读到的尺寸是已提交布局的最终尺寸。
55. **Framer Motion 不支持 `height: auto` 动画** — `animate={{ height: 'auto' }}` 静默失败，实际高度永远为 0，形成不可见拦截层。高度动画只能用确切像素值或放弃动画。
56. **Opencode 数据模型是 V1 message 表** — `session_message` 是 V2 表为空，实际消息在 V1 `message` 表，且字段名与 opencode CLI 输出不一致（`updated` vs `time_updated`，`role` vs `type`）。
57. **N+1 查询在 CLI 场景下是致命的性能杀手** — 每个 `runOpencode` 调用启动独立子进程（~100ms 开销）+ SQLite 查询（~200-500ms）。200 次 = 2 分钟。单次 `GROUP BY` 批量查询降到一次调用解决。
58. **Opencode 安装路径需检查 Chocolatey** — 全局 CLI 通过 Chocolatey 安装在 `C:\ProgramData\chocolatey\bin\opencode.exe`，非默认 `LOCALAPPDATA` 路径。
59. **React.lazy 要求模块有 `default` export** — 组件是命名导出时需包装：`React.lazy(() => import('./X').then(m => ({ default: m.X })))`。
60. **提示词管理存储为 exe 同级 `prompts/` 目录** — 通过 `app.isPackaged ? path.dirname(process.execPath) : app.getAppPath()` 确定基础路径。
61. **`opencode db <SQL>` 输出格式是 JSON 数组** — 通过解析 stdout 获取查询结果，无需 SQLite 绑定库。
62. **窗口最大化导致 RazerAppEngine 锁定打包目录** — `release/` 中 app.asar 被 RazerAppEngine 进程占用，electron-builder 无法覆盖。解决：更换输出目录到 `D:\mlx_build`。

### 全部 14 轮修改统计（更新）

| 轮次 | 日期 | 描述 | 新建文件 | 修改文件 |
|------|------|------|---------|---------|
| 第一轮 | 07-03 10:00 | 11项基础修复 | 3 | 14 |
| 第二轮 | 07-03 11:00 | 主题+面板+工具联动 | 0 | 8 |
| 第三轮 | 07-03 11:15 | 自定义主题系统 | 1 | 6 |
| 第四轮 | 07-03 12:00 | 主题全覆盖+焦点+拖拽 | 7 | 3 |
| 第五轮 | 07-03 12:13 | 面板拖拽+启动空白+CSS变量兼容 | 0 | 5 |
| 第六轮 | 07-05 14:00 | 布局拖拽+排序+磨砂玻璃 | 2 | 12 |
| 第七轮 | 07-05 17:00 | 细节打磨+终端焦点 | 0 | 6 |
| 第八轮 | 07-06 22:00 | Claude工具子系统 | 11 | 12 |
| 第八轮补充 | 07-06 23:00 | 对话框分组+面板resizer+最大化+Token | 0 | 5 |
| 第九轮 | 07-07 00:00 | 双击exe无法打开修复 | 0 | 0 |
| 第十轮 | 07-07 10:00 | 8项修复+增强+优化 | 0 | 10 |
| 第十一轮 | 07-13 00:00 | 双终端自动启动 | 0 | 6 |
| 第十二轮 | 07-13 14:00 | 终端"+"弹出命令选择对话框 | 1 | 1 |
| 第十三轮 | 07-14 17:00 | 终端复制粘贴+QuickTools+自动刷新 | 0 | 10 |
| **第十四轮** | **07-22 18:00** | **大规模优化+Opencode+内容搜索+提示词管理** | **8** | **20** |
| **第十五轮** | **07-23 10:00** | **QuickTools提示词按钮+导出图标+返回位置+Opencode日志** | **0** | **4** |
| **第十六轮** | **07-23 14:00** | **启动不建终端+进程退出+索引设置+ErrorBoundary+CM6懒加载+Claude异步+IPC优化** | **4** | **15** |
| **第十七轮** | **07-23 18:00** | **暗黑主题加深+主题应用修复+Opencode日志+EverythingSearch同步** | **0** | **6** |
| **第十八轮** | **07-23 23:30** | **环境统一+gitignore+索引默认路径+文档Mermaid框图+全量提交** | **0** | **7** |
| **合计** | | | **37文件** | **113+文件** |

---

## 第十六轮：全面优化（2026-07-23）

### 改动清单

...

---

## 第十七轮：主题修复+暗黑加深（2026-07-23）

### 改动

| # | 改动 | 文件 | 说明 |
|---|------|------|------|
| 1 | 暗黑主题加深 | `useThemeStore.ts` | 背景从 Tokyo Night (`#1a1b26`) 改为 Material Dark (`#0a0a0a`) |
| 2 | `clearInlineColors` 补终端色 | `useThemeStore.ts` | 缺少 `--terminal-bg`/`--terminal-fg`/`--terminal-cursor` 三个变量 |
| 3 | `handleApply` 内置主题分支修复 | `ThemeManager.tsx` | 内置主题也先 `applyColors` 保存编辑，不调 `setTheme`（清 inline） |
| 4 | Opencode 日志增强 | `claude-tools.ipc.ts` | 打印完整原始 SQL 输出前 2000 字符，方便排查字段名 |
| 5 | `electron.d.ts` 类型修正 | `electron.d.ts` | `fileIndexer.start` 签名改为 `(roots?: string[])` |
| 6 | EverythingSearch 同步 | `EverythingSearch.tsx` + `IndexSettings.tsx` + `useIndexSettingsStore.ts` | 补上之前遗漏的设置面板文件 |

### 经验教训

66. **`clearInlineColors` 必须覆盖所有 CSS 变量** — 漏掉终端色变量会导致自定义主题切换回内置主题后终端色残留
67. **`handleApply` 对内置主题不能调 `setTheme`** — `setTheme` → `applyTheme` → `clearInlineColors` 会清除用户实时编辑的内联颜色。应该直接 `previewColors(editingColors)` 保留编辑
68. **手工同步文件容易遗漏** — 第一次打包时 EverythingSearch 和 AppMain 的改动没有同步到 claudeforge，导致齿轮按钮不出现在打包版中。后续用批量脚本确保完整性

---

## 第十八轮：最终环境统一 + 文档完善（2026-07-23）

### 改动

| # | 改动 | 文件 | 说明 |
|---|------|------|------|
| 1 | 构建环境统一到 MLX_Tool_Git | `MLX_Tool_Git\` + `claudeforge\electron-builder.yml` | 复制 node_modules，`output:` 指向 `MLX_Tool_Git\release` |
| 2 | `.gitignore` 补全 | `.gitignore` | 追加 `release/*.yml` 排除 builder-debug.yml |
| 3 | 索引默认路径 = 家目录 + 项目目录 | `useIndexSettingsStore.ts`、`AppMain.tsx` | `load(projectPath)` 接收项目路径合并到 defaults |
| 4 | 文档 Mermaid 框图 | `docs/features.md`、`docs/features_CN.md` | 系统架构图、终端架构图、内容搜索流程图、提示词三级交互图 |

### 经验教训

69. **构建环境必须统一** — 之前用 `claudeforge/` 构建、`MLX_Tool_Git/` 做 git，文件同步遗漏导致打包版功能缺失。以后都从 `MLX_Tool_Git/` 构建。
70. **索引路径默认要覆盖常用目录** — 只扫家目录不够，项目目录才是用户真正搜索的地方。`useIndexSettingsStore.load(projectPath)` 接收项目路径作为参数。

### 改动清单

| # | 改动 | 文件 | 说明 |
|---|------|------|------|
| 1 | 启动不创建终端 | `TerminalPanel.tsx` | 删除 `initTerminals`，点 + 再选，启动更快 |
| 2 | 进程退不出修复 | `main.ts`、`terminal-manager.ts`、`filesystem.ipc.ts`、`claude-tools.ipc.ts` | `killAll()` + 集中清理所有子系统，`before-quit` 同步执行 |
| 3 | 文件索引设置面板 | **新建** `IndexSettings.tsx`、`useIndexSettingsStore.ts`、修改 `file-indexer.ts`、`EverythingSearch.tsx`、`AppMain.tsx` | 展开式目录树勾选，只索引用户选择的目录，默认只扫家目录 |
| 4 | Error Boundary | **新建** `ErrorBoundary.tsx`、修改 `AppMain.tsx` | 每个面板独立包裹，崩溃不影响其他面板 |
| 5 | Claude 对话异步化 | `claude-tools.ipc.ts` | `readFileSync` → `fs.promises.readFile` + `Promise.all` 并发 |
| 6 | CM6 语言包懒加载 | `CodeMirrorLanguageSupport.ts`、`NddEditor.tsx` | 14 个扩展改为动态 `import()`，首次打开对应文件时才加载 |
| 7 | 终端 IPC invoke→send | `preload.ts`、`terminal.ipc.ts` | `invoke` → `send`，减少 Promise 分配开销 |
| 8 | 删除死代码 | 删除 `TwoPanelLayout.tsx`、`ThreePanelLayout.tsx` | 95 行 0 引用旧文件 |
| 9 | 索引上限 30 万 + 跳过更多目录 | `file-indexer.ts` | `MAX_ENTRIES=300000`，追加 build/dist/target/vendor 等跳过 |
| 10 | 进程追踪 | `claude-tools.ipc.ts` | 子进程追踪 `activeProcesses` Set，shutdown 时全部 kill |

### 新文件（4个）

| 文件 | 说明 |
|------|------|
| `src/renderer/components/layout/ErrorBoundary.tsx` | React Error Boundary，崩溃时显示错误界面 + 重载按钮 |
| `src/renderer/stores/useIndexSettingsStore.ts` | 索引目录配置，localStorage 持久化 |
| `src/renderer/components/search/IndexSettings.tsx` | 展开式目录树勾选面板 |
| `src/renderer/components/plugins/PluginPanel.tsx`（已存在） | — |

### 经验教训

63. **CM6 语言包没有 `default` export** — 动态 `import()` 后需要检查 `typeof mod === 'function'` 还是 `mod.default`，两种格式都存在。
64. **Node.js 子进程追踪用 `Set<ChildProcess>`** — 在 `execFile` 回调中 `delete`，在 `killAll` 中遍历。注意 `replaceAll` 可能导致函数名重复。
65. **`before-quit` 是同步事件** — Electron 不 `await` 返回的 Promise，所有清理必须同步执行或用 `require` 同步加载。
| **合计** | | | **37文件** | **100+文件** |

---

## 第十五轮：修复与打磨（2026-07-23）

### Bug 1：QuickTools 缺少提示词管理按钮

**根因**：`QuickTools.tsx` 虽然有 `showPrompts` 和 `setShowPrompts` 的解构，但没有对应的 `if (!showPrompts)` 按钮块。

**修复**（`QuickTools.tsx`）：追加隐藏按钮块，使用 `VscSymbolRuler` 图标。

### Bug 2：Opencode 消息数排查

**根因**：批量查询 `SELECT session_id, COUNT(*) FROM message GROUP BY session_id` 的输出格式可能与预期不同（字段名不是 `session_id` 和 `c`）。

**修复**（`claude-tools.ipc.ts`）：
- 在解析前 `console.log` 原始输出（前 500 字符）
- 容错多种字段名：`session_id`/`id`、`message_count`/`c`/`count`

### Bug 3：导出按钮图标与返回按钮位置

**导出图标**：`VscExport` → `VscArrowDown`（向下箭头下载图标）

**返回按钮**：从标题栏右上方移到详情内容区顶部固定位置（`sticky top-0 z-10 bg-bg-deep`），带「返回」文字标签，不管滚动到哪都可见。

### 修改文件清单

| 文件 | 改动 |
|------|------|
| `src/renderer/components/layout/QuickTools.tsx` | + 提示词管理隐藏按钮 |
| `src/renderer/components/tools/ConversationManager.tsx` | VscExport→VscArrowDown + 返回按钮移到详情顶部sticky |
| `src/main/ipc/claude-tools.ipc.ts` | Opencode批量查询加日志 + 多字段名兼容 |
