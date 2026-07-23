export const IPC = {
  TERMINAL_CREATE: 'terminal:create',
  TERMINAL_WRITE: 'terminal:write',
  TERMINAL_RESIZE: 'terminal:resize',
  TERMINAL_KILL: 'terminal:kill',
  TERMINAL_RENAME: 'terminal:rename',
  TERMINAL_ON_DATA: 'terminal:on-data',

  FS_LIST: 'fs:list',
  FS_READ: 'fs:read',
  FS_READ_BINARY: 'fs:read-binary',
  FS_GET_FILE_INFO: 'fs:get-file-info',
  FS_WRITE: 'fs:write',
  FS_STAT: 'fs:stat',
  FS_CREATE_DIR: 'fs:create-dir',
  FS_DELETE: 'fs:delete',
  FS_RENAME: 'fs:rename',
  FS_ON_CHANGE: 'fs:on-change',
  FS_LIST_DRIVES: 'fs:list-drives',

  DIALOG_OPEN_FOLDER: 'dialog:open-folder',
  DIALOG_SAVE_FILE: 'dialog:save-file',

  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
  WINDOW_IS_MAXIMIZED: 'window:is-maximized',
  WINDOW_SET_BG: 'window:set-bg',

  PLANTUML_CHECK: 'plantuml:check',
  PLANTUML_RENDER: 'plantuml:render',

  FS_SEARCH: 'fs:search',
  FS_OPEN_FILE: 'fs:open-file',
  FS_SHOW_IN_FOLDER: 'fs:show-in-folder',
  FS_COPY_FILE: 'fs:copy-file',
  FS_START_WATCH: 'fs:start-watch',

  DIALOG_OPEN_FILE: 'dialog:open-file',

  FILE_INDEXER_SEARCH: 'file-indexer:search',
  FILE_INDEXER_STATUS: 'file-indexer:status',
  FILE_INDEXER_START: 'file-indexer:start',
  FILE_INDEXER_PROGRESS: 'file-indexer:progress',
  FILE_INDEXER_READY: 'file-indexer:ready',
  FILE_INDEXER_REINDEX: 'file-indexer:reindex',

  // Claude 工具子系统
  CLAUDE_CONVERSATIONS_LIST: 'claude:conversations-list',
  CLAUDE_CONVERSATION_RESUME: 'claude:conversation-resume',
  CLAUDE_CONVERSATION_DELETE: 'claude:conversation-delete',
  CLAUDE_CONVERSATION_MESSAGES: 'claude:conversation-messages',
  CLAUDE_SKILLS_LIST: 'claude:skills-list',
  CLAUDE_SKILL_INSTALL: 'claude:skill-install',
  CLAUDE_SKILL_DELETE: 'claude:skill-delete',
  CLAUDE_MCP_CONFIG: 'claude:mcp-config',
  CLAUDE_MCP_SAVE: 'claude:mcp-save',

  // Opencode 工具子系统
  OPENCODE_CONVERSATIONS_LIST: 'opencode:conversations-list',
  OPENCODE_CONVERSATION_RESUME: 'opencode:conversation-resume',
  OPENCODE_CONVERSATION_DELETE: 'opencode:conversation-delete',
  OPENCODE_CONVERSATION_MESSAGES: 'opencode:conversation-messages',

  // 内容搜索
  CONTENT_SEARCH: 'content:search',

  // 提示词管理
  PROMPTS_DIR: 'prompts:dir',
} as const;
