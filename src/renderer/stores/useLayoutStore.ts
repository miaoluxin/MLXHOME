import { create } from 'zustand';
import { useTerminalStore } from './useTerminalStore';

export type LayoutMode = 'free' | 'three-column-vertical' | 'three-column-horizontal';

interface LayoutState {
  leftWidth: number;
  centerWidth: number;
  rightWidth: number;
  browserWidth: number;
  bottomHeight: number;
  showFileBrowser: boolean;
  showEverythingSearch: boolean;
  showContentSearch: boolean;
  showTerminal: boolean;
  showEditor: boolean;
  showConversations: boolean;
  showSkills: boolean;
  showMcpConfig: boolean;
  showBrowser: boolean;
  showPrompts: boolean;
  layoutMode: LayoutMode;
  panelOrder: string[];
  panelWidths: Record<string, number>;

  setLeftWidth: (w: number) => void;
  setCenterWidth: (w: number) => void;
  setRightWidth: (w: number) => void;
  setBrowserWidth: (w: number) => void;
  setBottomHeight: (h: number) => void;
  setPanelWidth: (panelId: string, w: number) => void;
  toggleFileBrowser: () => void;
  setShowFileBrowser: (show: boolean) => void;
  toggleEverythingSearch: () => void;
  setShowEverythingSearch: (show: boolean) => void;
  toggleContentSearch: () => void;
  setShowContentSearch: (show: boolean) => void;
  setShowTerminal: (show: boolean) => void;
  setShowEditor: (show: boolean) => void;
  setShowConversations: (show: boolean) => void;
  setShowSkills: (show: boolean) => void;
  setShowMcpConfig: (show: boolean) => void;
  setShowBrowser: (show: boolean) => void;
  togglePrompts: () => void;
  setShowPrompts: (show: boolean) => void;
  initWidths: (totalWidth: number) => void;
  applyThreeColumnVertical: (totalWidth: number) => void;
  applyThreeColumnHorizontal: (totalWidth: number) => void;
  swapPanels: (fromId: string, toId: string) => void;
  setPanelOrder: (order: string[]) => void;
  setLayoutMode: (mode: LayoutMode) => void;
}

export const useLayoutStore = create<LayoutState>((set, get) => ({
  leftWidth: 400,
  centerWidth: 500,
  rightWidth: 400,
  browserWidth: 300,
  bottomHeight: 280,
  showFileBrowser: true,
  showEverythingSearch: false,
  showContentSearch: false,
  showTerminal: true,
  showEditor: true,
  showConversations: false,
  showSkills: false,
  showMcpConfig: false,
  showBrowser: false,
  showPrompts: false,
  layoutMode: 'free',
  panelOrder: ['terminal', 'editor', 'conversations', 'skills', 'mcpConfig', 'browser', 'prompts', 'fileBrowser', 'everythingSearch', 'contentSearch'],
  panelWidths: {
    terminal: 400,
    editor: 500,
    conversations: 300,
    skills: 300,
    mcpConfig: 300,
    browser: 400,
    fileBrowser: 300,
    everythingSearch: 350,
    contentSearch: 350,
    prompts: 350,
  },

  setLeftWidth: (w) => set((s) => ({ leftWidth: Math.max(200, w), panelWidths: { ...s.panelWidths, terminal: Math.max(200, w) } })),
  setCenterWidth: (w) => set((s) => ({ centerWidth: Math.max(300, w), panelWidths: { ...s.panelWidths, editor: Math.max(300, w) } })),
  setRightWidth: (w) => set((s) => ({ rightWidth: Math.max(200, w), panelWidths: { ...s.panelWidths, fileBrowser: Math.max(200, w) } })),
  setBrowserWidth: (w) => set((s) => ({ browserWidth: Math.max(200, w), panelWidths: { ...s.panelWidths, fileBrowser: Math.max(200, w) } })),
  setBottomHeight: (h) => set({ bottomHeight: Math.min(window.innerHeight - 250, Math.max(150, h)) }),

  toggleFileBrowser: () => set((s) => ({ showFileBrowser: !s.showFileBrowser })),
  setShowFileBrowser: (show) => {
    set({ showFileBrowser: show });
    if (!show) {
      const { showTerminal } = get();
      if (showTerminal) {
        const { focusActiveTerminal } = useTerminalStore.getState();
        setTimeout(() => focusActiveTerminal?.(), 50);
      }
    }
  },
  toggleEverythingSearch: () => set((s) => ({ showEverythingSearch: !s.showEverythingSearch })),
  setShowEverythingSearch: (show) => {
    set({ showEverythingSearch: show });
    if (!show) {
      const { showTerminal } = get();
      if (showTerminal) {
        const { focusActiveTerminal } = useTerminalStore.getState();
        setTimeout(() => focusActiveTerminal?.(), 50);
      }
    }
  },
  toggleContentSearch: () => set((s) => ({ showContentSearch: !s.showContentSearch })),
  setShowContentSearch: (show) => {
    set({ showContentSearch: show });
    if (!show) {
      const { showTerminal } = get();
      if (showTerminal) {
        const { focusActiveTerminal } = useTerminalStore.getState();
        setTimeout(() => focusActiveTerminal?.(), 50);
      }
    }
  },
  setShowTerminal: (show) => set({ showTerminal: show }),
  setShowEditor: (show) => {
    set({ showEditor: show });
    if (!show) {
      const { showTerminal } = get();
      if (showTerminal) {
        const { focusActiveTerminal } = useTerminalStore.getState();
        setTimeout(() => focusActiveTerminal?.(), 50);
      }
    }
  },
  setShowConversations: (show) => {
    set({ showConversations: show });
    if (!show) {
      const { showTerminal } = get();
      if (showTerminal) {
        const { focusActiveTerminal } = useTerminalStore.getState();
        setTimeout(() => focusActiveTerminal?.(), 50);
      }
    }
  },
  setShowSkills: (show) => {
    set({ showSkills: show });
    if (!show) {
      const { showTerminal } = get();
      if (showTerminal) {
        const { focusActiveTerminal } = useTerminalStore.getState();
        setTimeout(() => focusActiveTerminal?.(), 50);
      }
    }
  },
  setShowMcpConfig: (show) => {
    set({ showMcpConfig: show });
    if (!show) {
      const { showTerminal } = get();
      if (showTerminal) {
        const { focusActiveTerminal } = useTerminalStore.getState();
        setTimeout(() => focusActiveTerminal?.(), 50);
      }
    }
  },
  setShowBrowser: (show) => {
    set({ showBrowser: show });
    if (!show) {
      const { showTerminal } = get();
      if (showTerminal) {
        const { focusActiveTerminal } = useTerminalStore.getState();
        setTimeout(() => focusActiveTerminal?.(), 50);
      }
    }
  },
  togglePrompts: () => set((s) => ({ showPrompts: !s.showPrompts })),
  setShowPrompts: (show) => {
    set({ showPrompts: show });
    if (!show) {
      const { showTerminal } = get();
      if (showTerminal) {
        const { focusActiveTerminal } = useTerminalStore.getState();
        setTimeout(() => focusActiveTerminal?.(), 50);
      }
    }
  },

  initWidths: (totalWidth) => {
    // 只按比例调整宽度，不改变面板可见性（避免最大化时重置用户关闭的面板）
    const s = get();
    const visibleIds = s.panelOrder.filter((id) => {
      if (id === 'terminal') return s.showTerminal;
      if (id === 'editor') return s.showEditor || s.showFileBrowser; // editor 由 showEditor 或有文件控制
      if (id === 'fileBrowser') return s.showFileBrowser;
      if (id === 'everythingSearch') return s.showEverythingSearch;
      if (id === 'conversations') return s.showConversations;
      if (id === 'skills') return s.showSkills;
      if (id === 'mcpConfig') return s.showMcpConfig;
      if (id === 'browser') return s.showBrowser;
      return false;
    });
    const count = visibleIds.length || 1;
    const equal = Math.round(totalWidth / count);
    const pw: Record<string, number> = { ...s.panelWidths };
    visibleIds.forEach((id) => { pw[id] = Math.max(200, equal); });
    set({
      leftWidth: Math.round(totalWidth * 0.3),
      centerWidth: Math.round(totalWidth * 0.4),
      rightWidth: Math.round(totalWidth * 0.3),
      browserWidth: Math.round(totalWidth * 0.25),
      panelWidths: pw,
    });
  },

  applyThreeColumnVertical: (totalWidth) => {
    set({
      leftWidth: Math.round(totalWidth * 0.50),
      centerWidth: Math.round(totalWidth * 0.30),
      browserWidth: Math.round(totalWidth * 0.20),
      showTerminal: true,
      showEditor: true,
      showFileBrowser: true,
      showEverythingSearch: false,
      showConversations: false,
      showSkills: false,
      showMcpConfig: false,
      showBrowser: false,
      layoutMode: 'three-column-vertical',
    });
  },

  applyThreeColumnHorizontal: (totalWidth) => {
    set({
      leftWidth: Math.round(totalWidth * 0.33),
      centerWidth: Math.round(totalWidth * 0.34),
      browserWidth: Math.round(totalWidth * 0.33),
      bottomHeight: Math.round(window.innerHeight * 0.30),
      showTerminal: true,
      showEditor: true,
      showFileBrowser: true,
      showEverythingSearch: true,
      showConversations: false,
      showSkills: false,
      showMcpConfig: false,
      showBrowser: false,
      layoutMode: 'three-column-horizontal',
    });
  },

  swapPanels: (fromId, toId) => set((s) => {
    const order = [...s.panelOrder];
    const fromIdx = order.indexOf(fromId);
    const toIdx = order.indexOf(toId);
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return {};
    [order[fromIdx], order[toIdx]] = [order[toIdx], order[fromIdx]];
    return { panelOrder: order };
  }),

  setPanelOrder: (order) => set({ panelOrder: order }),

  setLayoutMode: (mode) => set({ layoutMode: mode }),

  setPanelWidth: (panelId, w) => set((s) => ({
    panelWidths: { ...s.panelWidths, [panelId]: Math.max(200, w) },
  })),
}));
