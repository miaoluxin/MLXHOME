import type { PreviewRenderer } from './plugin-types';

/**
 * 插件 API — 暴露给插件的完整能力
 */
export interface PluginAPI {
  editor: {
    getContent(): string;
    getLanguage(): string;
    onDidChange(cb: (text: string) => void): () => void;
  };
  views: {
    /** 注册预览渲染器 */
    registerPreview(language: string, renderer: PreviewRenderer): void;
    /** 取消注册预览渲染器 */
    unregisterPreview(language: string): void;
  };
  shortcuts: {
    /** 注册快捷键 */
    register(key: string, commandName: string, callback: () => void): void;
    /** 取消注册快捷键 */
    unregister(key: string): void;
  };
  notification: {
    show(message: string, type: 'info' | 'success' | 'error'): void;
  };
  http: {
    get(url: string): Promise<string>;
  };
  platform: {
    /** 获取 Node.js 路径（用于调用 java 等外部命令） */
    getNodePath(): string;
  };
}

// ── API 实现需要的外部依赖注入 ──
export interface PluginApiDeps {
  getEditorContent: () => string;
  getEditorLanguage: () => string;
  onEditorChange: (cb: (text: string) => void) => () => void;
  notify: (message: string, type: 'info' | 'success' | 'error') => void;
  getNodePath: () => string;
}

// ── 全局预览渲染器注册表 ──
const previewRenderers = new Map<string, PreviewRenderer>();

export function getPreviewRenderer(language: string): PreviewRenderer | undefined {
  return previewRenderers.get(language);
}

export function hasPreviewRenderer(language: string): boolean {
  return previewRenderers.has(language);
}

export function getAllPreviewLanguages(): string[] {
  return Array.from(previewRenderers.keys());
}

// ── 全局快捷键注册表 ──
const shortcutCallbacks = new Map<string, () => void>();

export function getShortcutCallback(key: string): (() => void) | undefined {
  return shortcutCallbacks.get(key);
}

export function clearShortcut(key: string): void {
  shortcutCallbacks.delete(key);
}

export function clearAllShortcuts(): void {
  shortcutCallbacks.clear();
}

/** 创建插件 API 实例 */
export function createPluginAPI(deps: PluginApiDeps): PluginAPI {
  return {
    editor: {
      getContent: deps.getEditorContent,
      getLanguage: deps.getEditorLanguage,
      onDidChange: deps.onEditorChange,
    },
    views: {
      registerPreview: (language: string, renderer: PreviewRenderer) => {
        previewRenderers.set(language, renderer);
      },
      unregisterPreview: (language: string) => {
        previewRenderers.delete(language);
      },
    },
    shortcuts: {
      register: (key: string, _commandName: string, callback: () => void) => {
        shortcutCallbacks.set(key, callback);
      },
      unregister: (key: string) => {
        shortcutCallbacks.delete(key);
      },
    },
    notification: {
      show: deps.notify,
    },
    http: {
      get: async (url: string) => {
        try {
          const res = await fetch(url);
          return res.ok ? await res.text() : '';
        } catch {
          return '';
        }
      },
    },
    platform: {
      getNodePath: deps.getNodePath,
    },
  };
}
