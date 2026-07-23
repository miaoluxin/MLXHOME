# MLX Forge Architecture

## System Architecture

```mermaid
graph TB
    subgraph "Main Process (Electron)"
        direction TB
        M[main.ts] --> TM[TerminalManager<br/>PTY session management]
        M --> FI[FileIndexer<br/>Disk file indexer]
        M --> PI[Prompts Init<br/>Prompts directory setup]
        M --> IPC[IPC Handlers<br/>terminal / filesystem /<br/>dialog / window /<br/>plantuml / claude-tools /<br/>file-indexer / prompts]
    end

    subgraph "Renderer Process (React)"
        direction TB
        R[React 19] --> ST[Zustand Stores<br/>9 state stores]
        R --> UI[Components<br/>Terminal / Editor / FileBrowser /<br/>Search / Conversations / Prompts / ...]
        R --> CM[CodeMirror 6<br/>Editor with 40+ languages]
        R --> XT[XTerm.js 5.3<br/>Terminal emulator]
    end

    subgraph "Preload"
        P[contextBridge<br/>Secure API bridge]
    end

    IPC --> P
    P --> R
    TM -->|node-pty| PS[PowerShell PTY]
    FI -->|v8 serialize| DISK[(Index cache)]
    PI -->|fs| PD[(prompts/ directory)]
```

## Process Model

MLX Forge follows the standard Electron security model:

| Layer | Process | Responsibilities |
|-------|---------|-----------------|
| Main | Node.js | Window management, native APIs, child processes, file I/O |
| Renderer | Chromium | UI rendering, user interaction |
| Preload | Isolated | Secure `contextBridge.exposeInMainWorld` API |

All IPC is strictly typed through `ipc-channels.ts` and `electron.d.ts`.

## Data Flow

```mermaid
sequenceDiagram
    participant User
    participant UI as React Component
    participant Store as Zustand Store
    participant Preload as contextBridge
    participant IPC as ipcMain.handle
    participant Service as Main Process Service

    User->>UI: Click action
    UI->>Store: Zustand action
    Store->>Preload: window.electronAPI.xxx()
    Preload->>IPC: ipcRenderer.invoke()
    IPC->>Service: Service method
    Service-->>IPC: Result
    IPC-->>Preload: Promise resolves
    Preload-->>Store: Data
    Store-->>UI: React re-render
    UI-->>User: Visual feedback
```

## Panel System

```mermaid
graph LR
    subgraph "Panel System (10 panels)"
        T[TerminalPanel]
        E[EditorPanel]
        F[FileBrowser]
        ES[EverythingSearch<br/>File name search]
        CS[ContentSearch<br/>File content search]
        C[ConversationManager<br/>Claude / Opencode]
        P[PromptManager<br/>Prompt library]
        S[SkillManager]
        M[McpConfigTool]
        B[BrowserTool<br/>WebView]
    end

    subgraph "Layout Management"
        Q[QuickTools<br/>Floating toolbar]
        D[DraggablePanelHeader<br/>Drag & reorder]
        LS[useLayoutStore<br/>showXxx / panelOrder / panelWidths]
    end

    Q -->|Show hidden panels| T & E & F & ES & CS & C & P & S & M & B
    D -->|Swap positions| LS
    LS -->|CSS display:none| Visibility
```

## Store Architecture

| Store | State | Key Actions |
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
