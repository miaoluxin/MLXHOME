import { create } from 'zustand';

interface Conversation {
  id: string;
  title: string;
  date: string;
  messageCount: number;
  projectPath: string;
}

interface Message {
  role: string;
  content: string;
  timestamp: string;
  tokens?: { input: number; output: number };
  model?: string;
}

type ConversationTool = 'claude' | 'opencode';

interface ConversationState {
  tool: ConversationTool;
  conversations: Conversation[];
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  messages: Message[];
  messagesLoading: boolean;
  totalInputTokens: number;
  totalOutputTokens: number;
  tokenModel: string | undefined;
  setTool: (tool: ConversationTool) => void;
  loadConversations: () => Promise<void>;
  selectConversation: (id: string, projectPath: string) => Promise<void>;
  resumeConversation: (id: string) => Promise<string>;
  deleteConversation: (id: string, projectPath: string) => Promise<void>;
  clearSelection: () => void;
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  tool: 'claude',
  conversations: [],
  loading: false,
  error: null,
  selectedId: null,
  messages: [],
  messagesLoading: false,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  tokenModel: undefined,

  setTool: (tool) => {
    set({ tool, selectedId: null, messages: [], conversations: [] });
    get().loadConversations();
  },

  loadConversations: async () => {
    const { tool } = get();
    set({ loading: true, error: null });
    try {
      const api = tool === 'claude' ? window.electronAPI.claudeTools : window.electronAPI.opencodeTools;
      const conversations = await api.listConversations();
      set({ conversations, loading: false });
    } catch (err: any) {
      set({ error: err.message || '加载对话失败', loading: false });
    }
  },

  selectConversation: async (id, projectPath) => {
    const { tool } = get();
    set({ selectedId: id, messagesLoading: true, messages: [], totalInputTokens: 0, totalOutputTokens: 0, tokenModel: undefined });
    try {
      const api = tool === 'claude' ? window.electronAPI.claudeTools : window.electronAPI.opencodeTools;
      const result = await api.getConversationMessages(id, projectPath);
      set({
        messages: result.messages || [],
        totalInputTokens: result.totalInputTokens || 0,
        totalOutputTokens: result.totalOutputTokens || 0,
        tokenModel: result.model,
        messagesLoading: false,
      });
    } catch (err: any) {
      set({ messages: [], messagesLoading: false });
    }
  },

  resumeConversation: async (id) => {
    const { tool } = get();
    const api = tool === 'claude' ? window.electronAPI.claudeTools : window.electronAPI.opencodeTools;
    const result = await api.resumeConversation(id);
    return result.command;
  },

  deleteConversation: async (id, projectPath) => {
    const { tool } = get();
    const api = tool === 'claude' ? window.electronAPI.claudeTools : window.electronAPI.opencodeTools;
    try {
      await api.deleteConversation(id, projectPath);
      if (get().selectedId === id) set({ selectedId: null, messages: [] });
      get().loadConversations();
    } catch { /* ignore */ }
  },

  clearSelection: () => set({ selectedId: null, messages: [], totalInputTokens: 0, totalOutputTokens: 0, tokenModel: undefined }),
}));
