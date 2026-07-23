import { create } from 'zustand';

interface FileClipboardState {
  paths: string[];
  operation: 'copy' | 'cut' | null;
  hasEntries: boolean;
  setClipboard: (paths: string[], operation: 'copy' | 'cut') => void;
  clearClipboard: () => void;
}

export const useFileClipboardStore = create<FileClipboardState>((set) => ({
  paths: [],
  operation: null,
  hasEntries: false,
  setClipboard: (paths, operation) => set({ paths, operation, hasEntries: true }),
  clearClipboard: () => set({ paths: [], operation: null, hasEntries: false }),
}));
