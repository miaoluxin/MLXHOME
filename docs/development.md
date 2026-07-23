# MLX Forge — Development Guide / 二次开发指南

## Project Structure / 项目结构

```
src/
├── main/                # Electron Main Process
│   ├── main.ts          # Entry: window creation, lifecycle
│   ├── ipc/             # IPC handlers (terminal, filesystem, dialog, etc.)
│   └── services/        # Backend services (TerminalManager, FileIndexer)
├── preload/             # contextBridge API
│   └── preload.ts
├── renderer/            # React UI
│   ├── main.tsx         # React entry
│   ├── App.tsx          # Root component
│   ├── AppMain.tsx      # Main layout + panel registration
│   ├── components/      # Components by domain
│   │   ├── terminal/    # TerminalPanel, XTerm, TerminalTabs
│   │   ├── editor/      # EditorPanel, NddEditor, CodeMirrorTheme
│   │   ├── filesystem/  # FileBrowser, FileTree, FileRow
│   │   ├── layout/      # AppShell, PanelResizer, QuickTools
│   │   ├── tools/       # ConversationManager, PromptManager, etc.
│   │   ├── search/      # ContentSearch
│   │   ├── theme/       # ThemeManager
│   │   ├── plugins/     # Plugin system
│   │   └── onboarding/  # FolderPicker
│   ├── stores/          # Zustand state stores
│   ├── styles/          # CSS with Tailwind
│   ├── types/           # TypeScript declarations (electron.d.ts)
│   └── plugin-system/   # Plugin API + built-in plugins
└── shared/              # Shared between main & renderer
    ├── ipc-channels.ts  # IPC channel names
    └── types.ts         # Shared types (FileEntry, EditorTab, etc.)
```

## How State Flows / 状态流转

```
User Action → React Component → Zustand Store → preload API (IPC invoke)
  → Main Process handler → Service → result → back to Store → UI re-render
```

### Adding a simple IPC / 添加一个简单 IPC

```typescript
// 1. Define channel in shared/ipc-channels.ts
export const IPC = {
  MY_FEATURE_DO_SOMETHING: 'my-feature:do-something',
};

// 2. Add handler in main/ipc/
import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';
export function registerMyFeatureIpc() {
  ipcMain.handle(IPC.MY_FEATURE_DO_SOMETHING, async (_event, arg: string) => {
    return `Hello, ${arg}!`;
  });
}

// 3. Register in main.ts
import('./ipc/my-feature.ipc').then(m => m.registerMyFeatureIpc());

// 4. Expose in preload.ts
myFeature: {
  doSomething: (arg: string) => ipcRenderer.invoke(IPC.MY_FEATURE_DO_SOMETHING, arg),
},

// 5. Add type in types/electron.d.ts
myFeature: {
  doSomething: (arg: string) => Promise<string>;
};

// 6. Call from any component
const result = await window.electronAPI.myFeature.doSomething('world');
```

## Adding a New Panel / 添加新面板

1. **DraggablePanelHeader.tsx**: Add `'myPanel'` to `PanelId` type
2. **useLayoutStore.ts**: Add `showMyPanel` + `setShowMyPanel` + toggle
3. **Create component**: Use `DraggablePanelHeader` + `glass-panel` + `flex-col`
4. **AppMain.tsx**: Add `React.lazy` import + panelComponentMap entry + visibleSlots + panelOrder
5. **AppShell.tsx**: Add checkbox to View → "工具显示" submenu
6. **QuickTools.tsx**: Add toggle button (if needed)

## Coding Conventions / 编码规范

- **Components**: Named exports (`export function XTerm()`), not default
- **Stores**: Zustand `create()` with explicit interface + create function
- **Styles**: Tailwind utility classes only; no inline styles for layout
- **CSS variables**: Use `var(--xxx)` — avoid Tailwind opacity modifiers (`/90`) with CSS vars
- **Panel ID**: Register in `DraggablePanelHeader.PanelId` union type
- **IPC channels**: Constant names in `ipc-channels.ts`, typed return in `electron.d.ts`
- **Dynamic imports**: Non-critical features use `React.lazy()` + dynamic `import()`

## Key Anti-Patterns to Avoid / 避免的反模式

1. ❌ Framer Motion `height: auto` — 不支持，会导致零高度不可见层
2. ❌ xterm 5.3 `attachCustomKeyEventHandler` return value — 返回 boolean 被忽略，必须用 `preventDefault()`
3. ❌ Tailwind opacity modifiers (`bg-bg-deep/90`) with CSS vars — 生成无效 CSS
4. ❌ N+1 queries in CLI context — 每个 `execFile` 调用开销 50-200ms
5. ❌ ResizeObserver without `requestAnimationFrame` — 读到中间态 0 尺寸
