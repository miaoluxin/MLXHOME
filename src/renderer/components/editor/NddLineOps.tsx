import { useCallback, useState, useRef, useEffect } from 'react';

export type LineOp =
  | 'sort-asc'
  | 'sort-desc'
  | 'dedup'
  | 'remove-empty'
  | 'reverse'
  | 'upper'
  | 'lower'
  | 'proper'
  | 'trim-start'
  | 'trim-end'
  | 'trim-both';

interface NddLineOpsProps {
  onExecute: (op: LineOp, text: string) => void;
  getSelectedText?: () => string;
}

interface MenuItem {
  op: LineOp;
  label: string;
  group: string;
}

const MENU_ITEMS: MenuItem[] = [
  { op: 'sort-asc', label: '升序排序', group: '排序' },
  { op: 'sort-desc', label: '降序排序', group: '排序' },
  { op: 'reverse', label: '反转行序', group: '排序' },
  { op: 'dedup', label: '移除重复行', group: '排序' },
  { op: 'remove-empty', label: '移除空行', group: '编辑' },
  { op: 'trim-start', label: '去除行首空白', group: '编辑' },
  { op: 'trim-end', label: '去除行尾空白', group: '编辑' },
  { op: 'trim-both', label: '去除首尾空白', group: '编辑' },
  { op: 'upper', label: '转大写', group: '大小写' },
  { op: 'lower', label: '转小写', group: '大小写' },
  { op: 'proper', label: '首字母大写', group: '大小写' },
];

export function NddLineOps({ onExecute, getSelectedText }: NddLineOpsProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    // 延迟绑定，避免触发当前点击
    setTimeout(() => document.addEventListener('click', handleClick), 0);
    return () => document.removeEventListener('click', handleClick);
  }, [open]);

  const execute = useCallback(
    (op: LineOp) => {
      const text = getSelectedText?.();
      onExecute(op, text ?? '');
      setOpen(false);
    },
    [onExecute, getSelectedText]
  );

  const groups = MENU_ITEMS.reduce<Record<string, MenuItem[]>>((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {});

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="px-2 py-1 rounded text-text-secondary hover:text-text-primary
                   hover:bg-bg-hover transition-colors text-xs"
        title="行操作"
      >
        行操作 ▾
      </button>

      {open && (
        <div
          className="absolute top-full right-0 mt-1 z-50 min-w-[160px]
                     bg-bg-raised border border-border-subtle rounded-lg
                     shadow-xl py-1 text-xs"
        >
          {Object.entries(groups).map(([groupName, items]) => (
            <div key={groupName}>
              {groupName !== '排序' && (
                <div className="h-px bg-border-subtle my-1" />
              )}
              <div className="px-3 py-1 text-text-tertiary text-[10px] uppercase tracking-wider">
                {groupName}
              </div>
              {items.map((item) => (
                <button
                  key={item.op}
                  onClick={() => execute(item.op)}
                  className="w-full text-left px-3 py-1.5 text-text-secondary
                             hover:bg-bg-hover hover:text-text-primary transition-colors"
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** 行操作工具函数 */
export function applyLineOp(op: LineOp, text: string): string {
  if (!text) return text;

  const lines = text.split('\n');
  let result: string[];

  switch (op) {
    case 'sort-asc':
      result = [...lines].sort((a, b) => a.localeCompare(b));
      break;
    case 'sort-desc':
      result = [...lines].sort((a, b) => b.localeCompare(a));
      break;
    case 'dedup':
      result = [...new Set(lines)];
      break;
    case 'remove-empty':
      result = lines.filter((l) => l.trim().length > 0);
      break;
    case 'reverse':
      result = [...lines].reverse();
      break;
    case 'upper':
      result = lines.map((l) => l.toUpperCase());
      break;
    case 'lower':
      result = lines.map((l) => l.toLowerCase());
      break;
    case 'proper':
      result = lines.map((l) =>
        l.replace(/\b\w/g, (c) => c.toUpperCase())
      );
      break;
    case 'trim-start':
      result = lines.map((l) => l.trimStart());
      break;
    case 'trim-end':
      result = lines.map((l) => l.trimEnd());
      break;
    case 'trim-both':
      result = lines.map((l) => l.trim());
      break;
    default:
      result = lines;
  }

  return result.join('\n');
}
