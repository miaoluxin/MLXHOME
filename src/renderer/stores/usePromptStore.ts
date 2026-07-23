import { create } from 'zustand';

export type PromptView = 'list' | 'detail' | 'edit';

interface PromptEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

interface PromptState {
  entries: PromptEntry[];
  selectedPath: string | null;
  selectedContent: string;
  selectedTitle: string;
  editContent: string;
  view: PromptView;
  changed: boolean;

  loadTree: (dir: string) => Promise<void>;
  selectPrompt: (filePath: string) => Promise<void>;
  saveEdit: () => Promise<void>;
  startEdit: () => void;
  cancelEdit: () => void;
  setEditContent: (content: string) => void;
  goBack: () => void;
  createPrompt: (dir: string) => Promise<string | null>;
  createFolder: (parentDir: string) => Promise<string | null>;
  deletePrompt: (filePath: string) => Promise<boolean>;
  renamePrompt: (oldPath: string, newName: string) => Promise<boolean>;
}

export const usePromptStore = create<PromptState>((set, get) => ({
  entries: [],
  selectedPath: null,
  selectedContent: '',
  selectedTitle: '',
  editContent: '',
  view: 'list',
  changed: false,

  loadTree: async (dir) => {
    try {
      const list = await window.electronAPI.fs.list(dir);
      set({ entries: list });
    } catch { set({ entries: [] }); }
  },

  selectPrompt: async (filePath) => {
    try {
      const content = await window.electronAPI.fs.read(filePath);
      const title = content.split('\n')[0]?.replace(/^#\s*/, '')?.trim() || filePath.split(/[/\\]/).pop()?.replace('.md', '') || '未命名';
      set({ selectedPath: filePath, selectedContent: content, selectedTitle: title, editContent: content, view: 'detail', changed: false });
    } catch { /* ignore */ }
  },

  saveEdit: async () => {
    const { selectedPath, editContent } = get();
    if (!selectedPath) return;
    try {
      await window.electronAPI.fs.write(selectedPath, editContent);
      set({ selectedContent: editContent, view: 'detail', changed: false });
    } catch { /* ignore */ }
  },

  startEdit: () => {
    const { selectedContent } = get();
    set({ editContent: selectedContent, view: 'edit', changed: false });
  },

  cancelEdit: () => {
    const { selectedContent } = get();
    set({ editContent: selectedContent, view: 'detail', changed: false });
  },

  setEditContent: (content) => set({ editContent: content, changed: true }),

  goBack: () => {
    const { changed, selectedPath, selectedContent } = get();
    if (changed) {
      const ok = window.confirm('有未保存的修改，确定放弃吗？');
      if (!ok) return;
    }
    set({ selectedPath: null, selectedContent: '', selectedTitle: '', editContent: '', view: 'list', changed: false });
  },

  createPrompt: async (dir) => {
    const name = prompt('请输入提示词名称（不含扩展名）:');
    if (!name) return null;
    const filePath = dir.replace(/\\/g, '/') + '/' + name.trim() + '.md';
    try {
      await window.electronAPI.fs.write(filePath, '# ' + name.trim() + '\n\n');
      return filePath;
    } catch { alert('创建失败'); return null; }
  },

  createFolder: async (parentDir) => {
    const name = prompt('请输入分组名称:');
    if (!name) return null;
    try {
      await window.electronAPI.fs.createDir(parentDir, name.trim());
      return parentDir + '/' + name.trim();
    } catch { alert('创建失败'); return null; }
  },

  deletePrompt: async (filePath) => {
    const name = filePath.split('/').pop() || filePath.split('\\').pop() || '';
    const ok = window.confirm(`确定删除 "${name}" 吗？`);
    if (!ok) return false;
    try {
      await window.electronAPI.fs.delete(filePath);
      return true;
    } catch { alert('删除失败'); return false; }
  },

  renamePrompt: async (oldPath, newName) => {
    const parentDir = oldPath.replace(/\\/g, '/').substring(0, oldPath.replace(/\\/g, '/').lastIndexOf('/'));
    const newPath = parentDir + '/' + newName;
    if (newPath === oldPath) return true;
    try {
      await window.electronAPI.fs.rename(oldPath, newPath);
      return true;
    } catch { alert('重命名失败'); return false; }
  },
}));
