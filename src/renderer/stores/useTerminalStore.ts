import { create } from 'zustand';

export interface TerminalTab {
  id: string;
  label: string;
}

interface TerminalState {
  tabs: TerminalTab[];
  activeId: string | null;
  counter: number;
  focusActiveTerminal: (() => void) | null;
  setActiveId: (id: string | null) => void;
  addTab: (tab: TerminalTab) => void;
  removeTab: (id: string) => void;
  renameTab: (id: string, label: string) => void;
  incrementCounter: () => void;
  setFocusFn: (fn: (() => void) | null) => void;
  resetAll: () => void;
}

export const useTerminalStore = create<TerminalState>((set) => ({
  tabs: [],
  activeId: null,
  counter: 1,
  focusActiveTerminal: null,

  setActiveId: (id) => set({ activeId: id }),

  addTab: (tab) =>
    set((s) => ({ tabs: [...s.tabs, tab], activeId: tab.id })),

  removeTab: (id) =>
    set((s) => {
      const next = s.tabs.filter((t) => t.id !== id);
      let active = s.activeId;
      if (active === id) {
        active = next[0]?.id ?? null;
      }
      return { tabs: next, activeId: active };
    }),

  renameTab: (id, label) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === id ? { ...t, label } : t)),
    })),

  incrementCounter: () => set((s) => ({ counter: s.counter + 1 })),

  setFocusFn: (fn) => set({ focusActiveTerminal: fn }),

  resetAll: () => set({ tabs: [], activeId: null, counter: 1 }),
}));
