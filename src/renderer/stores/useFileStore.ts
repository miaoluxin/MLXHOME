import { create } from 'zustand';
import type { FileEntry } from '../../shared/types';

interface FileState {
  currentPath: string;
  entries: FileEntry[];
  selectedPath: string | null;
  isLoading: boolean;
  refreshTrigger: number;
  setCurrentPath: (path: string) => void;
  setEntries: (entries: FileEntry[]) => void;
  setSelectedPath: (path: string | null) => void;
  setLoading: (loading: boolean) => void;
  triggerRefresh: () => void;
}

export const useFileStore = create<FileState>((set) => ({
  currentPath: '',
  entries: [],
  selectedPath: null,
  isLoading: false,
  refreshTrigger: 0,
  setCurrentPath: (path) => set({ currentPath: path }),
  setEntries: (entries) => set({ entries }),
  setSelectedPath: (path) => set({ selectedPath: path }),
  setLoading: (loading) => set({ isLoading: loading }),
  triggerRefresh: () => set((s) => ({ refreshTrigger: s.refreshTrigger + 1 })),
}));
