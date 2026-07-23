import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/ipc-channels';

const electronAPI = {
  terminal: {
    create: (options: any) => ipcRenderer.invoke(IPC.TERMINAL_CREATE, options),
    write: (sessionId: string, data: string) => { ipcRenderer.send(IPC.TERMINAL_WRITE, sessionId, data); },
    resize: (sessionId: string, cols: number, rows: number) => ipcRenderer.invoke(IPC.TERMINAL_RESIZE, sessionId, cols, rows),
    kill: (sessionId: string) => ipcRenderer.invoke(IPC.TERMINAL_KILL, sessionId),
    rename: (sessionId: string, label: string) => ipcRenderer.invoke(IPC.TERMINAL_RENAME, sessionId, label),
    onData: (callback: (sessionId: string, data: string) => void) => {
      const handler = (_event: any, sessionId: string, data: string) => callback(sessionId, data);
      ipcRenderer.on(IPC.TERMINAL_ON_DATA, handler);
      return () => ipcRenderer.removeListener(IPC.TERMINAL_ON_DATA, handler);
    },
  },
  fs: {
    list: (dirPath: string) => ipcRenderer.invoke(IPC.FS_LIST, dirPath),
    read: (filePath: string) => ipcRenderer.invoke(IPC.FS_READ, filePath),
    readBinary: (filePath: string) => ipcRenderer.invoke(IPC.FS_READ_BINARY, filePath),
    getFileInfo: (filePath: string) => ipcRenderer.invoke(IPC.FS_GET_FILE_INFO, filePath),
    write: (filePath: string, content: string) => ipcRenderer.invoke(IPC.FS_WRITE, filePath, content),
    stat: (filePath: string) => ipcRenderer.invoke(IPC.FS_STAT, filePath),
    createDir: (parentPath: string, name: string) => ipcRenderer.invoke(IPC.FS_CREATE_DIR, parentPath, name),
    delete: (targetPath: string) => ipcRenderer.invoke(IPC.FS_DELETE, targetPath),
    rename: (oldPath: string, newPath: string) => ipcRenderer.invoke(IPC.FS_RENAME, oldPath, newPath),
    listDrives: () => ipcRenderer.invoke(IPC.FS_LIST_DRIVES),
    openFile: (filePath: string) => ipcRenderer.invoke(IPC.FS_OPEN_FILE, filePath),
    showInFolder: (filePath: string) => ipcRenderer.invoke(IPC.FS_SHOW_IN_FOLDER, filePath),
    copyFile: (srcPath: string, destPath: string) => ipcRenderer.invoke(IPC.FS_COPY_FILE, srcPath, destPath),
    startWatch: (dirPath: string) => ipcRenderer.invoke(IPC.FS_START_WATCH, dirPath),
    onChange: (callback: (eventType: string, filePath: string) => void) => {
      const handler = (_event: any, eventType: string, filePath: string) => callback(eventType, filePath);
      ipcRenderer.on(IPC.FS_ON_CHANGE, handler);
      return () => ipcRenderer.removeListener(IPC.FS_ON_CHANGE, handler);
    },
  },

  // ── 文件索引器 ──
  fileIndexer: {
    search: (query: string) => ipcRenderer.invoke(IPC.FILE_INDEXER_SEARCH, query),
    getStatus: () => ipcRenderer.invoke(IPC.FILE_INDEXER_STATUS),
    start: () => ipcRenderer.invoke(IPC.FILE_INDEXER_START),
    reindex: (roots?: string[]) => ipcRenderer.invoke(IPC.FILE_INDEXER_REINDEX, roots),
    onProgress: (callback: (data: { indexed: number; estimatedTotal: number }) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on(IPC.FILE_INDEXER_PROGRESS, handler);
      return () => ipcRenderer.removeListener(IPC.FILE_INDEXER_PROGRESS, handler);
    },
    onReady: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on(IPC.FILE_INDEXER_READY, handler);
      return () => ipcRenderer.removeListener(IPC.FILE_INDEXER_READY, handler);
    },
  },
  dialog: {
    openFolder: () => ipcRenderer.invoke(IPC.DIALOG_OPEN_FOLDER),
    openFile: () => ipcRenderer.invoke(IPC.DIALOG_OPEN_FILE),
    saveFile: () => ipcRenderer.invoke(IPC.DIALOG_SAVE_FILE),
  },
  window: {
    minimize: () => ipcRenderer.invoke(IPC.WINDOW_MINIMIZE),
    maximize: () => ipcRenderer.invoke(IPC.WINDOW_MAXIMIZE),
    close: () => ipcRenderer.invoke(IPC.WINDOW_CLOSE),
    isMaximized: () => ipcRenderer.invoke(IPC.WINDOW_IS_MAXIMIZED),
    setBackgroundColor: (color: string) => ipcRenderer.invoke(IPC.WINDOW_SET_BG, color),
  },
  plantuml: {
    check: () => ipcRenderer.invoke(IPC.PLANTUML_CHECK),
    render: (content: string) => ipcRenderer.invoke(IPC.PLANTUML_RENDER, content),
  },
  opencodeTools: {
    listConversations: () => ipcRenderer.invoke(IPC.OPENCODE_CONVERSATIONS_LIST),
    getConversationMessages: (id: string, projectPath: string) => ipcRenderer.invoke(IPC.OPENCODE_CONVERSATION_MESSAGES, id, projectPath),
    resumeConversation: (id: string) => ipcRenderer.invoke(IPC.OPENCODE_CONVERSATION_RESUME, id),
    deleteConversation: (id: string, filePath: string) => ipcRenderer.invoke(IPC.OPENCODE_CONVERSATION_DELETE, id, filePath),
  },
  claudeTools: {
    listConversations: () => ipcRenderer.invoke(IPC.CLAUDE_CONVERSATIONS_LIST),
    getConversationMessages: (id: string, projectPath: string) => ipcRenderer.invoke('claude:conversation-messages', id, projectPath),
    resumeConversation: (id: string) => ipcRenderer.invoke(IPC.CLAUDE_CONVERSATION_RESUME, id),
    deleteConversation: (id: string, filePath: string) => ipcRenderer.invoke(IPC.CLAUDE_CONVERSATION_DELETE, id, filePath),
    listSkills: () => ipcRenderer.invoke(IPC.CLAUDE_SKILLS_LIST),
    installSkill: () => ipcRenderer.invoke(IPC.CLAUDE_SKILL_INSTALL),
    deleteSkill: (skillPath: string) => ipcRenderer.invoke(IPC.CLAUDE_SKILL_DELETE, skillPath),
    getMcpConfig: () => ipcRenderer.invoke(IPC.CLAUDE_MCP_CONFIG),
    saveMcpConfig: (servers: Record<string, any>) => ipcRenderer.invoke(IPC.CLAUDE_MCP_SAVE, servers),
  },
  contentSearch: {
    search: (rootDir: string, query: string) => ipcRenderer.invoke(IPC.CONTENT_SEARCH, rootDir, query),
  },
  prompts: {
    getDir: () => ipcRenderer.invoke(IPC.PROMPTS_DIR),
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
