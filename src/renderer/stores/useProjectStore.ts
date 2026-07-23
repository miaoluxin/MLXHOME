import { create } from 'zustand';

const PATH_KEY = 'mlx-project-path';
const ONBOARDING_KEY = 'mlx-onboarding-completed';

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch { return fallback; }
}

function saveToStorage(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

interface ProjectState {
  projectPath: string | null;
  hasCompletedOnboarding: boolean;
  switchTrigger: number;
  setProjectPath: (path: string) => void;
  completeOnboarding: () => void;
  triggerSwitch: () => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projectPath: loadFromStorage<string | null>(PATH_KEY, null),
  hasCompletedOnboarding: loadFromStorage<boolean>(ONBOARDING_KEY, false),
  switchTrigger: 0,
  setProjectPath: (path) => {
    saveToStorage(PATH_KEY, path);
    set({ projectPath: path });
  },
  completeOnboarding: () => {
    saveToStorage(ONBOARDING_KEY, true);
    set({ hasCompletedOnboarding: true });
  },
  triggerSwitch: () => set((s) => ({ switchTrigger: s.switchTrigger + 1 })),
}));
