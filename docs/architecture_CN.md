# MLX 架构设计

## 系统架构

```mermaid
graph TB
    subgraph "主进程 (Electron)"
        M[main.ts] --> TM[TerminalManager<br/>PTY 会话管理]
        M --> FI[FileIndexer<br/>文件索引引擎]
        M --> PI[Prompts Init<br/>提示词目录初始化]
        M --> IPC[IPC Handlers<br/>terminal / filesystem /<br/>dialog / window /<br/>plantuml / claude-tools /<br/>file-indexer / prompts]
    end

    subgraph "渲染进程 (React)"
        R[React 19] --> ST[Zustand Stores<br/>9 个状态管理]
        R --> UI[组件<br/>终端 / 编辑器 / 文件浏览器 /<br/>搜索 / 对话管理 / 提示词 / ...]
        R --> CM[CodeMirror 6<br/>编辑器，40+ 语言支持]
        R --> XT[XTerm.js 5.3<br/>终端模拟器]
    end

    subgraph "Preload"
        P[contextBridge<br/>安全 API 桥接]
    end

    IPC --> P
    P --> R
    TM -->|node-pty| PS[PowerShell PTY]
    FI -->|v8 serialize| DISK[(索引缓存)]
    PI -->|fs| PD[(prompts/ 目录)]
```

## 进程模型

| 层 | 进程 | 职责 |
|-------|---------|-----------------|
| Main | Node.js | 窗口管理、原生 API、子进程、文件 I/O |
| Renderer | Chromium | UI 渲染、用户交互 |
| Preload | 隔离环境 | 安全的 `contextBridge.exposeInMainWorld` API |

所有 IPC 通过 `ipc-channels.ts` 和 `electron.d.ts` 严格类型化。

## 数据流

```mermaid
sequenceDiagram
    participant User as 用户
    participant UI as React 组件
    participant Store as Zustand Store
    participant Preload as contextBridge
    participant IPC as ipcMain.handle
    participant Service as 主进程服务

    User->>UI: 点击操作
    UI->>Store: Zustand action
    Store->>Preload: window.electronAPI.xxx()
    Preload->>IPC: ipcRenderer.invoke()
    IPC->>Service: 服务方法
    Service-->>IPC: 结果
    IPC-->>Preload: Promise 完成
    Preload-->>Store: 数据
    Store-->>UI: React 重渲染
    UI-->>User: 视觉反馈
```

## 面板系统

```mermaid
graph LR
    subgraph "面板系统 (10 个面板)"
        T[TerminalPanel 终端]
        E[EditorPanel 编辑器]
        F[FileBrowser 文件浏览器]
        ES[EverythingSearch<br/>文件名搜索]
        CS[ContentSearch<br/>文件内容搜索]
        C[ConversationManager<br/>Claude / Opencode]
        P[PromptManager<br/>提示词库]
        S[SkillManager]
        M[McpConfigTool]
        B[BrowserTool<br/>浏览器]
    end

    subgraph "布局管理"
        Q[QuickTools<br/>浮动工具栏]
        D[DraggablePanelHeader<br/>拖拽排序]
        LS[useLayoutStore<br/>showXxx / panelOrder / panelWidths]
    end

    Q -->|显示隐藏面板| T & E & F & ES & CS & C & P & S & M & B
    D -->|交换位置| LS
    LS -->|CSS display:none| 可见性控制
```

## Store 架构

| Store | 状态 | 关键方法 |
|-------|-------|-------------|
| `useProjectStore` | projectPath, onboarding | setProjectPath, completeOnboarding |
| `useLayoutStore` | showXxx, panelOrder, widths | toggleFileBrowser, swapPanels |
| `useEditorStore` | openFiles, activeFileId | openFile, closeFile, batchRestore |
| `useTerminalStore` | sessions, activeId | addSession, closeSession |
| `useFileStore` | currentPath, entries | setCurrentPath, setEntries |
| `useThemeStore` | current, customThemes | setTheme, addCustomTheme |
| `useConversationStore` | conversations, messages | loadConversations, selectConversation |
| `usePromptStore` | entries, view, editContent | loadTree, selectPrompt, saveEdit |
| `useFileClipboardStore` | paths, operation | setClipboard, clearClipboard |
| `usePluginStore` | installed, active | setBuiltin, installPlugin |
| `useFavoritesStore` | favorites | addFavorite, removeFavorite |
