import { create } from 'zustand';
import type { EditorView } from '@codemirror/view';
import type { EditorTab } from '../../shared/types';

const LANG_MAP: Record<string, string> = {
  '.js': 'javascript', '.jsx': 'jsx', '.ts': 'typescript',
  '.tsx': 'tsx', '.json': 'json', '.html': 'html',
  '.css': 'css', '.md': 'markdown', '.py': 'python', '.java': 'java',
  '.cs': 'csharp', '.xml': 'xml', '.yaml': 'yaml', '.yml': 'yaml',
  '.svg': 'xml', '.txt': 'plaintext', '.sql': 'sql', '.sh': 'shell',
  '.ps1': 'powershell', '.toml': 'ini', '.ini': 'ini', '.rs': 'rust',
  '.go': 'go', '.rb': 'ruby', '.php': 'php', '.c': 'c', '.cpp': 'cpp',
  '.h': 'c', '.scss': 'scss', '.less': 'less',
  '.puml': 'plaintext', '.plantuml': 'plaintext',
  '.vue': 'html', '.svelte': 'html',
  '.gradle': 'groovy', '.properties': 'ini',
  '.dockerfile': 'plaintext', '.cmake': 'plaintext',
  '.kt': 'plaintext', '.kts': 'plaintext',
  '.swift': 'plaintext', '.dart': 'plaintext',
  '.lua': 'plaintext', '.r': 'plaintext',
  '.groovy': 'plaintext', '.scala': 'plaintext',
  '.pl': 'plaintext', '.pm': 'plaintext',
  '.erl': 'plaintext', '.ex': 'plaintext', '.exs': 'plaintext',
  '.hs': 'plaintext', '.elm': 'plaintext',
  '.clj': 'plaintext', '.cljs': 'plaintext',
  '.fs': 'plaintext', '.fsx': 'plaintext',
  '.v': 'plaintext', '.vhdl': 'plaintext',
  '.proto': 'plaintext', '.tf': 'plaintext', '.tfvars': 'plaintext',
  '.makefile': 'plaintext', '.mk': 'plaintext',
  '.env': 'ini', '.lock': 'plaintext',
  '.log': 'plaintext', '.diff': 'plaintext', '.patch': 'plaintext',
  '.bash': 'bash', '.zsh': 'zsh',
  '.plist': 'xml', '.storyboard': 'xml', '.xib': 'xml',
  '.graphql': 'plaintext', '.gql': 'plaintext',
  '.zig': 'plaintext', '.tex': 'plaintext', '.latex': 'plaintext',
  '.sass': 'scss',
};

function getLanguage(filePath: string): string {
  const idx = filePath.lastIndexOf('.');
  if (idx === -1) return 'plaintext';
  const ext = filePath.slice(idx).toLowerCase();
  return LANG_MAP[ext] || 'plaintext';
}

/** 检测文件换行符类型 */
function detectLineEnding(content: string): 'CRLF' | 'LF' | 'CR' {
  const crlf = content.indexOf('\r\n');
  const lf = content.indexOf('\n', crlf === 0 ? 1 : 0);
  const cr = content.indexOf('\r');
  if (crlf >= 0) return 'CRLF';
  if (lf >= 0) return 'LF';
  if (cr >= 0) return 'CR';
  return 'LF'; // 默认
}

export interface FindOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  useRegex: boolean;
}

interface EditorState {
  // ── 标签页 ──
  openFiles: EditorTab[];
  activeFileId: string | null;
  /** 未命名文件自增计数 */
  untitledCount: number;

  // ── 面板状态 ──
  showFindPanel: boolean;
  showReplacePanel: boolean;
  showHexView: boolean;

  // ── 编辑状态 ──
  readOnly: boolean;
  zoomLevel: number;            // 缩放百分比, 100 = 默认
  cursorPosition: { line: number; col: number } | null;
  encoding: string;
  lineEnding: 'CRLF' | 'LF' | 'CR';

  // ── 视图选项 ──
  wordWrap: boolean;
  showWhitespace: boolean;
  columnMode: boolean;

  // ── 标签页方法 ──
  setActiveFile: (id: string) => void;
  openFile: (filePath: string, content: string) => void;
  closeFile: (id: string) => void;
  setContent: (id: string, content: string) => void;
  markClean: (id: string) => void;
  createNewFile: () => string;
  saveAsFile: (id: string, newPath: string, newContent: string) => void;

  // ── 面板切换 ──
  toggleFindPanel: () => void;
  toggleReplacePanel: () => void;
  toggleHexView: () => void;

  // ── 编辑设置 ──
  setEncoding: (enc: string) => void;
  setLineEnding: (le: 'CRLF' | 'LF' | 'CR') => void;
  setZoom: (level: number) => void;
  setCursorPosition: (pos: { line: number; col: number } | null) => void;
  setReadOnly: (ro: boolean) => void;

  // ── 编辑器视图引用 (供菜单栏撤销/重做使用) ──
  editorView: EditorView | null;
  setEditorView: (view: EditorView | null) => void;

  // ── 视图切换 ──
  toggleWordWrap: () => void;
  toggleWhitespace: () => void;
  toggleColumnMode: () => void;

  // ── 会话恢复 ──
  batchRestore: (
    files: Array<{ id: string; path: string; name: string; language: string; content: string; isDirty: boolean }>,
    activeId: string | null,
    cursorPos: { line: number; col: number } | null,
    zoom: number,
    wrap: boolean,
  ) => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  // ── 初始状态 ──
  openFiles: [],
  activeFileId: null,
  untitledCount: 0,
  showFindPanel: false,
  showReplacePanel: false,
  showHexView: false,
  readOnly: false,
  zoomLevel: 100,
  cursorPosition: null,
  encoding: 'utf-8',
  lineEnding: 'LF',
  wordWrap: false,
  showWhitespace: false,
  columnMode: false,
  editorView: null,

  // ── 标签页方法 ──
  setActiveFile: (id) => set({ activeFileId: id }),

  openFile: (filePath, content) => {
    const existing = get().openFiles.find((f) => f.path === filePath);
    if (existing) {
      set({ activeFileId: existing.id });
      return;
    }
    const name = filePath.split(/[/\\]/).pop() || filePath;
    const id = Math.random().toString(36).substring(2, 10);
    const tab: EditorTab = {
      id, path: filePath, name,
      language: getLanguage(filePath),
      content, isDirty: false,
    };
    set((s) => ({
      openFiles: [...s.openFiles, tab],
      activeFileId: id,
      showFindPanel: false,
      showReplacePanel: false,
      showHexView: false,
      readOnly: false,
      zoomLevel: 100,
      cursorPosition: null,
      encoding: 'utf-8',
      lineEnding: detectLineEnding(content),
    }));
  },

  closeFile: (id) => {
    set((s) => {
      const idx = s.openFiles.findIndex((f) => f.id === id);
      const next = s.openFiles.filter((f) => f.id !== id);
      let active = s.activeFileId;
      if (active === id) {
        active = next[Math.min(idx, next.length - 1)]?.id ?? null;
      }
      return {
        openFiles: next,
        activeFileId: active,
        showFindPanel: active ? s.showFindPanel : false,
        showReplacePanel: active ? s.showReplacePanel : false,
        showHexView: active ? s.showHexView : false,
      };
    });
  },

  setContent: (id, content) => {
    set((s) => ({
      openFiles: s.openFiles.map((f) =>
        f.id === id ? { ...f, content, isDirty: true } : f
      ),
    }));
  },

  markClean: (id) => {
    set((s) => ({
      openFiles: s.openFiles.map((f) =>
        f.id === id ? { ...f, isDirty: false } : f
      ),
    }));
  },

  createNewFile: () => {
    const count = get().untitledCount + 1;
    const id = Math.random().toString(36).substring(2, 10);
    const name = `未命名-${count}`;
    const tab: EditorTab = {
      id, path: '', name,
      language: 'plaintext',
      content: '', isDirty: true,
    };
    set((s) => ({
      openFiles: [...s.openFiles, tab],
      activeFileId: id,
      untitledCount: count,
      showFindPanel: false,
      showReplacePanel: false,
      showHexView: false,
      readOnly: false,
      zoomLevel: 100,
      cursorPosition: null,
      encoding: 'utf-8',
      lineEnding: 'LF',
    }));
    return id;
  },

  saveAsFile: (id, newPath, newContent) => {
    const name = newPath.split(/[/\\]/).pop() || newPath;
    set((s) => ({
      openFiles: s.openFiles.map((f) =>
        f.id === id ? { ...f, path: newPath, name, language: getLanguage(newPath), content: newContent, isDirty: false } : f
      ),
    }));
  },

  // ── 面板切换 ──
  toggleFindPanel: () => set((s) => ({ showFindPanel: !s.showFindPanel, showReplacePanel: false })),

  toggleReplacePanel: () => set((s) => {
    const open = !s.showReplacePanel;
    return { showReplacePanel: open, showFindPanel: open || s.showFindPanel };
  }),

  toggleHexView: () => set((s) => ({ showHexView: !s.showHexView })),

  // ── 编辑设置 ──
  setEncoding: (enc) => set({ encoding: enc }),

  setLineEnding: (le) => set({ lineEnding: le }),

  setZoom: (level) => set({ zoomLevel: Math.max(50, Math.min(400, level)) }),

  setCursorPosition: (pos) => set({ cursorPosition: pos }),

  setReadOnly: (ro) => set({ readOnly: ro }),

  // ── 视图切换 ──
  toggleWordWrap: () => set((s) => ({ wordWrap: !s.wordWrap })),

  toggleWhitespace: () => set((s) => ({ showWhitespace: !s.showWhitespace })),

  toggleColumnMode: () => set((s) => ({ columnMode: !s.columnMode })),

  setEditorView: (view) => set({ editorView: view }),

  // ── 会话恢复 ──
  batchRestore: (files, activeId, cursorPos, zoom, wrap) => {
    const tabs = files as EditorTab[];
    let lineEnding: 'CRLF' | 'LF' | 'CR' = 'LF';
    if (tabs.length > 0 && tabs[0].content) {
      const c = tabs[0].content;
      if (c.includes('\r\n')) lineEnding = 'CRLF';
      else if (c.includes('\r')) lineEnding = 'CR';
    }
    set({
      openFiles: tabs,
      activeFileId: activeId,
      cursorPosition: cursorPos,
      zoomLevel: zoom,
      wordWrap: wrap,
      lineEnding,
      showFindPanel: false,
      showReplacePanel: false,
      showHexView: false,
      readOnly: false,
      encoding: 'utf-8',
    });
  },
}));
