import { create } from 'zustand';

interface McpState {
  configPath: string | null;
  servers: Record<string, any>;
  loading: boolean;
  error: string | null;
  loadConfig: () => Promise<void>;
}

export const useMcpStore = create<McpState>((set) => ({
  configPath: null,
  servers: {},
  loading: false,
  error: null,
  loadConfig: async () => {
    set({ loading: true, error: null });
    try {
      const config = await window.electronAPI.claudeTools.getMcpConfig();
      set({ configPath: config.path, servers: config.servers, loading: false });
    } catch (err: any) {
      set({ error: err.message || '加载 MCP 配置失败', loading: false });
    }
  },
}));
