import { create } from 'zustand';

interface ProjectState {
  projectPath: string | null;
  hasCompletedOnboarding: boolean;
  switchTrigger: number;
  setProjectPath: (path: string) => void;
  completeOnboarding: () => void;
  triggerSwitch: () => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projectPath: null,
  hasCompletedOnboarding: false,
  switchTrigger: 0,
  setProjectPath: (path) => set({ projectPath: path }),
  completeOnboarding: () => set({ hasCompletedOnboarding: true }),
  triggerSwitch: () => set((s) => ({ switchTrigger: s.switchTrigger + 1 })),
}));
