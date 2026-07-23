import { create } from 'zustand';

const STORAGE_KEY = 'mlx-index-roots';

interface IndexSettingsState {
  roots: string[];
  initialized: boolean;
  load: (projectPath?: string) => void;
  setRoots: (roots: string[]) => void;
  addRoot: (root: string) => void;
  removeRoot: (root: string) => void;
}

export const useIndexSettingsStore = create<IndexSettingsState>((set, get) => ({
  roots: [],
  initialized: false,

  load: (projectPath?: string) => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        set({ roots: JSON.parse(raw), initialized: true });
      } else {
        // 默认：家目录 + 项目目录
        const home = process.env.USERPROFILE || '';
        const dirs: string[] = [];
        if (home) dirs.push(home);
        if (projectPath && !dirs.includes(projectPath)) dirs.push(projectPath);
        set({ roots: dirs, initialized: true });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dirs));
      }
    } catch {
      set({ initialized: true });
    }
  },

  setRoots: (roots) => {
    set({ roots });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(roots));
  },

  addRoot: (root) => {
    const { roots } = get();
    if (!roots.includes(root)) {
      const next = [...roots, root];
      set({ roots: next });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  },

  removeRoot: (root) => {
    const { roots } = get();
    const next = roots.filter(r => r !== root);
    set({ roots: next });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  },
}));
