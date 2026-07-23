import { VscClose } from 'react-icons/vsc';
import { useEffect } from 'react';

interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string; desc: string }[];
}

const GROUPS: ShortcutGroup[] = [
  {
    title: '文件',
    shortcuts: [
      { keys: 'Ctrl+N', desc: '新建文件' },
      { keys: 'Ctrl+O', desc: '打开文件' },
      { keys: 'Ctrl+S', desc: '保存' },
      { keys: 'Ctrl+Shift+S', desc: '另存为' },
      { keys: 'Ctrl+W', desc: '关闭标签' },
    ],
  },
  {
    title: '编辑',
    shortcuts: [
      { keys: 'Ctrl+Z', desc: '撤销' },
      { keys: 'Ctrl+Y', desc: '重做' },
      { keys: 'Ctrl+F', desc: '查找' },
      { keys: 'Ctrl+H', desc: '查找替换' },
      { keys: 'Ctrl+D', desc: '选中下一个匹配' },
    ],
  },
  {
    title: '视图',
    shortcuts: [
      { keys: 'Ctrl+B', desc: '切换文件浏览器' },
      { keys: 'Ctrl+Shift+F', desc: '内容搜索' },
      { keys: 'Ctrl+= / Ctrl+-', desc: '缩放' },
      { keys: 'Ctrl+0', desc: '重置缩放' },
    ],
  },
  {
    title: '终端',
    shortcuts: [
      { keys: 'F2', desc: '重命名文件/目录' },
      { keys: 'Delete', desc: '删除文件/目录' },
    ],
  },
  {
    title: '项目',
    shortcuts: [
      { keys: 'Ctrl+Shift+P', desc: '切换项目' },
    ],
  },
];

interface Props {
  onClose: () => void;
}

export function ShortcutHelp({ onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-bg-raised border border-border-subtle rounded-xl shadow-2xl w-[520px] max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
          <span className="text-sm font-medium text-text-primary">快捷键</span>
          <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary">
            <VscClose size={16} />
          </button>
        </div>
        <div className="p-4 space-y-4">
          {GROUPS.map((group) => (
            <div key={group.title}>
              <div className="text-[10px] font-medium text-text-tertiary uppercase tracking-wider mb-2">{group.title}</div>
              {group.shortcuts.map((s) => (
                <div key={s.keys} className="flex items-center justify-between py-1.5">
                  <span className="text-xs text-text-secondary">{s.desc}</span>
                  <kbd className="px-2 py-0.5 bg-bg-deep border border-border-subtle rounded text-[10px] text-text-primary font-mono">{s.keys}</kbd>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="px-4 py-2 border-t border-border-subtle text-[10px] text-text-tertiary text-center">
          Ctrl+Shift+/ 随时打开此面板
        </div>
      </div>
    </div>
  );
}
