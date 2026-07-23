const SESSION_KEY = 'mlx-session';
const MAX_DIRTY_SIZE = 500 * 1024; // 500KB
const MAX_FILES = 10;

/** 持久化的标签页数据 */
export interface PersistedTab {
  id: string;
  path: string;
  name: string;
  language: string;
  /** dirty 且 <=500KB 时保存完整内容，clean 文件或超大文件存空串 */
  content: string;
  isDirty: boolean;
}

export interface SessionData {
  version: number; // 当前版本 2: 包含完整 layoutState
  timestamp: number;
  /** 文件浏览器当前路径 */
  fileBrowserPath: string;
  openFiles: PersistedTab[];
  activeFileId: string | null;
  cursorPosition: { line: number; col: number } | null;
  zoomLevel: number;
  /** @deprecated 保留兼容 v1，v2 使用 layoutState.panelWidths */
  layoutWidths: { left: number; center: number; right: number };
  wordWrap: boolean;
  /** v2: 完整布局状态 */
  layoutState?: {
    showTerminal: boolean;
    showEditor: boolean;
    showFileBrowser: boolean;
    showEverythingSearch: boolean;
    showConversations: boolean;
    showSkills: boolean;
    showMcpConfig: boolean;
    showBrowser: boolean;
    layoutMode: string;
    panelOrder: string[];
    panelWidths: Record<string, number>;
    bottomHeight: number;
    browserWidth: number;
  };
}

/** 保存到 localStorage */
export function persistSession(data: SessionData): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('[Session] 保存会话失败:', e);
  }
}

/** 从 localStorage 读取会话数据 */
export function loadSession(): SessionData | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SessionData;
    if (data.version < 1 || data.version > 2) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * 从各 store 收集状态并序列化
 * 由调用方传入 store getState 返回值，避免循环依赖
 */
export function collectSessionData(params: {
  openFiles: Array<{ id: string; path: string; name: string; language: string; content: string; isDirty: boolean }>;
  activeFileId: string | null;
  fileBrowserPath: string;
  cursorPosition: { line: number; col: number } | null;
  zoomLevel: number;
  layoutWidths: { left: number; center: number; right: number };
  wordWrap: boolean;
  layoutState?: SessionData['layoutState'];
}): SessionData {
  const persistedTabs: PersistedTab[] = params.openFiles.slice(0, MAX_FILES).map((tab) => {
    const shouldSaveContent = tab.isDirty && tab.content.length <= MAX_DIRTY_SIZE;
    return {
      id: tab.id,
      path: tab.path,
      name: tab.name,
      language: tab.language,
      content: shouldSaveContent ? tab.content : '',
      isDirty: tab.isDirty,
    };
  });

  return {
    version: 2,
    timestamp: Date.now(),
    fileBrowserPath: params.fileBrowserPath,
    openFiles: persistedTabs,
    activeFileId: params.activeFileId,
    cursorPosition: params.cursorPosition,
    zoomLevel: params.zoomLevel,
    layoutWidths: params.layoutWidths,
    wordWrap: params.wordWrap,
    layoutState: params.layoutState,
  };
}

/** 清除会话缓存 */
export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch { /* ignore */ }
}
