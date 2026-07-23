export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modified: string;
  extension: string;
}

export interface TerminalCreateOptions {
  cwd: string;
  shell?: string;
  cols?: number;
  rows?: number;
}

export interface EditorTab {
  id: string;
  path: string;
  name: string;
  language: string;
  content: string;
  isDirty: boolean;
}

export interface SearchResult {
  path: string;
  name: string;
  isDirectory: boolean;
  size: number;
  modified: string;
}

export interface IndexStatus {
  isReady: boolean;
  isScanning: boolean;
  indexedCount: number;
}
