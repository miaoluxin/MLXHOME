import { create } from 'zustand';

interface Skill {
  name: string;
  description: string;
  source: string;
  path: string;
  enabled: boolean;
}

interface SkillState {
  skills: Skill[];
  loading: boolean;
  error: string | null;
  loadSkills: () => Promise<void>;
}

export const useSkillStore = create<SkillState>((set) => ({
  skills: [],
  loading: false,
  error: null,
  loadSkills: async () => {
    set({ loading: true, error: null });
    try {
      const skills = await window.electronAPI.claudeTools.listSkills();
      set({ skills, loading: false });
    } catch (err: any) {
      set({ error: err.message || '加载 Skill 失败', loading: false });
    }
  },
}));
