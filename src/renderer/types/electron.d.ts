import type { FileEntry, SearchResult, IndexStatus } from '../../shared/types';

export interface ElectronAPI {
  terminal: {
    create: (options: { cwd: string; cols?: number; rows?: number; command?: string }) => Promise<string>;
    write: (sessionId: string, data: string) => Promise<void>;
    resize: (sessionId: string, cols: number, rows: number) => Promise<void>;
    kill: (sessionId: string) => Promise<void>;
    rename: (sessionId: string, label: string) => Promise<void>;
    onData: (callback: (sessionId: string, data: string) => void) => () => void;
  };
  fs: {
    list: (dirPath: string) => Promise<FileEntry[]>;
    read: (filePath: string) => Promise<string>;
    readBinary: (filePath: string) => Promise<string>;
    getFileInfo: (filePath: string) => Promise<{ size: number; modified: string; lineEnding: 'CRLF' | 'LF' | 'CR' }>;
    write: (filePath: string, content: string) => Promise<void>;
    stat: (filePath: string) => Promise<any>;
    createDir: (parentPath: string, name: string) => Promise<void>;
    delete: (targetPath: string) => Promise<void>;
    rename: (oldPath: string, newPath: string) => Promise<void>;
    listDrives: () => Promise<string[]>;
    openFile: (filePath: string) => Promise<void>;
    showInFolder: (filePath: string) => Promise<void>;
    copyFile: (srcPath: string, destPath: string) => Promise<void>;
    startWatch: (dirPath: string) => Promise<void>;
    onChange: (callback: (eventType: string, filePath: string) => void) => () => void;
  };
  fileIndexer: {
    search: (query: string) => Promise<SearchResult[]>;
    getStatus: () => Promise<IndexStatus>;
    start: (roots?: string[]) => Promise<void>;
    reindex: (roots?: string[]) => Promise<void>;
    onProgress: (callback: (data: { indexed: number; estimatedTotal: number }) => void) => () => void;
    onReady: (callback: () => void) => () => void;
  };
  dialog: {
    openFolder: () => Promise<string | null>;
    openFile: () => Promise<string | null>;
    saveFile: () => Promise<string | null>;
  };
  window: {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
    isMaximized: () => Promise<boolean>;
    setBackgroundColor: (color: string) => Promise<void>;
  };
  plantuml: {
    check: () => Promise<{ javaAvailable: boolean; javaVersion?: string; jarDownloaded: boolean; error: string | null }>;
    render: (content: string) => Promise<{ success: boolean; svg?: string; error?: string }>;
  };
  opencodeTools: {
    listConversations: () => Promise<Array<{ id: string; title: string; date: string; messageCount: number; projectPath: string }>>;
    getConversationMessages: (id: string, projectPath: string) => Promise<{
      messages: Array<{ role: string; content: string; timestamp: string }>;
      totalInputTokens: number;
      totalOutputTokens: number;
      model?: string;
    }>;
    resumeConversation: (id: string) => Promise<{ command: string }>;
    deleteConversation: (id: string, filePath: string) => Promise<{ success: boolean; error?: string }>;
  };
  prompts: {
    getDir: () => Promise<string>;
  };
  contentSearch: {
    search: (rootDir: string, query: string) => Promise<Array<{ file: string; line: number; column: number; lineContent: string }>>;
  };
  claudeTools: {
    listConversations: () => Promise<Array<{ id: string; title: string; date: string; messageCount: number; projectPath: string }>>;
    getConversationMessages: (id: string, projectPath: string) => Promise<{
      messages: Array<{ role: string; content: string; timestamp: string; tokens?: { input: number; output: number }; model?: string }>;
      totalInputTokens: number;
      totalOutputTokens: number;
      model?: string;
    }>;
    resumeConversation: (id: string) => Promise<{ command: string }>;
    deleteConversation: (id: string, filePath: string) => Promise<{ success: boolean; error?: string }>;
    listSkills: () => Promise<Array<{ name: string; description: string; source: string; path: string; enabled: boolean }>>;
    installSkill: () => Promise<{ success: boolean; path?: string; command?: string; error?: string }>;
    deleteSkill: (skillPath: string) => Promise<{ success: boolean; error?: string }>;
    getMcpConfig: () => Promise<{ path: string | null; servers: Record<string, any>; error?: string }>;
    saveMcpConfig: (servers: Record<string, any>) => Promise<{ success: boolean; path?: string; error?: string }>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
