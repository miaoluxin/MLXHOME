import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { VscFolder, VscFolderOpened, VscError, VscChromeClose, VscHistory } from 'react-icons/vsc';

const RECENT_KEY = 'mlx-recent-projects';
const MAX_RECENT = 10;

function getRecentProjects(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
}

export function saveRecentProject(path: string) {
  const list = getRecentProjects().filter(p => p !== path);
  list.unshift(path);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
}

interface Props {
  onSelect: (path: string) => void;
}

export function FolderPicker({ onSelect }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => { setRecent(getRecentProjects()); }, []);

  const handlePick = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!window.electronAPI?.dialog?.openFolder) {
        setError('API 未加载，请重启应用');
        return;
      }
      const path = await window.electronAPI.dialog.openFolder();
      if (path) {
        saveRecentProject(path);
        onSelect(path);
      }
    } catch (err: any) {
      console.error('FolderPicker error:', err);
      setError(err?.message || '打开文件夹选择器失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRecent = (path: string) => {
    saveRecentProject(path);
    onSelect(path);
  };

  return (
    <div className="h-full w-full flex items-center justify-center bg-bg-deepest">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="glass-panel p-10 w-[480px] text-center flex flex-col items-center gap-6 relative"
      >
        <button onClick={() => window.electronAPI.window.close()}
          className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-md text-text-tertiary hover:text-red-400 hover:bg-red-400/10 transition-colors" title="关闭">
          <VscChromeClose size={16} />
        </button>

        <motion.div animate={{ rotate: [0, -5, 5, 0] }} transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}>
          <VscFolderOpened size={64} className="text-accent" />
        </motion.div>

        <div>
          <h1 className="text-2xl font-semibold text-text-primary mb-2">MLX</h1>
          <p className="text-[11px] text-accent tracking-widest mb-1">Make! Learn! Extraordinary!</p>
          <p className="text-text-secondary text-sm leading-relaxed">
            AI 驱动的桌面开发环境<br />选择项目文件夹，AI 将自动在终端中启动
          </p>
        </div>

        {error && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs">
            <VscError size={14} /><span>{error}</span>
          </motion.div>
        )}

        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          onClick={handlePick} disabled={loading}
          className="px-8 py-3 bg-accent hover:bg-accent-hover text-white rounded-lg font-medium text-sm transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
          <VscFolder size={18} />{loading ? '请选择文件夹...' : '选择项目文件夹'}
        </motion.button>

        {recent.length > 0 && (
          <div className="w-full border-t border-border-subtle pt-4">
            <div className="flex items-center gap-1.5 text-[10px] text-text-tertiary mb-2">
              <VscHistory size={12} /> 最近打开
            </div>
            {recent.slice(0, 5).map((path) => (
              <button key={path} onClick={() => handleRecent(path)}
                className="w-full text-left px-3 py-1.5 rounded text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors truncate">
                {path}
              </button>
            ))}
          </div>
        )}

        <p className="text-text-tertiary text-xs">选择文件夹后，将自动打开终端并运行 AI CLI</p>
      </motion.div>
    </div>
  );
}
