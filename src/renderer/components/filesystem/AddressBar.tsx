import { useState, useEffect, useCallback, useRef } from 'react';
import { VscChevronRight, VscEdit, VscServerEnvironment } from 'react-icons/vsc';

interface Props {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export function AddressBar({ currentPath, onNavigate }: Props) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [showDrives, setShowDrives] = useState(false);
  const [drives, setDrives] = useState<string[]>([]);
  const driveMenuRef = useRef<HTMLDivElement>(null);

  const segments = currentPath
    .split(/[/\\]+/)
    .filter(Boolean);

  // Windows 盘符特殊处理
  const hasDrive = segments.length > 0 && segments[0].match(/^[A-Za-z]:$/);

  // ── 加载驱动器列表 ──
  useEffect(() => {
    window.electronAPI.fs.listDrives().then(setDrives).catch(() => {});
  }, []);

  // ── 点击外部关闭驱动器菜单 ──
  useEffect(() => {
    if (!showDrives) return;
    const handleClick = (e: MouseEvent) => {
      if (driveMenuRef.current && !driveMenuRef.current.contains(e.target as Node)) {
        setShowDrives(false);
      }
    };
    setTimeout(() => document.addEventListener('click', handleClick), 0);
    return () => document.removeEventListener('click', handleClick);
  }, [showDrives]);

  const handleSegmentClick = (index: number) => {
    let parts: string[];
    if (hasDrive) {
      parts = segments.slice(0, index + 1);
      onNavigate(parts.join('\\'));
    } else {
      parts = segments.slice(0, index + 1);
      onNavigate('/' + parts.join('/'));
    }
  };

  const handleEditStart = () => {
    setEditValue(currentPath);
    setEditing(true);
  };

  const handleEditSubmit = () => {
    setEditing(false);
    onNavigate(editValue);
  };

  const handleDriveSelect = (drive: string) => {
    setShowDrives(false);
    onNavigate(drive);
  };

  return (
    <div className="flex items-center h-9 px-2 gap-1">
      {/* ── 驱动器下拉按钮 ── */}
      <div className="relative" ref={driveMenuRef}>
        <button
          onClick={() => setShowDrives((v) => !v)}
          className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
          title="选择磁盘驱动器"
        >
          <VscServerEnvironment size={15} />
        </button>

        {showDrives && (
          <div
            className="absolute top-full left-0 mt-1 z-50 min-w-[180px]
                       bg-bg-raised border border-border-subtle rounded-lg
                       shadow-xl py-1 text-xs"
          >
            <div className="px-3 py-1 text-text-tertiary text-[10px] uppercase tracking-wider">
              磁盘驱动器
            </div>
            {drives.map((drive) => {
              const isCurrent = currentPath.toUpperCase().startsWith(drive.toUpperCase());
              return (
                <button
                  key={drive}
                  onClick={() => handleDriveSelect(drive)}
                  className={`w-full text-left px-3 py-1.5 flex items-center gap-2 transition-colors
                    ${isCurrent
                      ? 'bg-accent/15 text-accent'
                      : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                    }`}
                >
                  <VscServerEnvironment size={14} className={isCurrent ? 'text-accent' : ''} />
                  <span className="font-medium">{drive}</span>
                  {isCurrent && <span className="ml-auto text-[10px] text-accent">当前</span>}
                </button>
              );
            })}
            {drives.length === 0 && (
              <div className="px-3 py-2 text-text-tertiary">正在加载...</div>
            )}
          </div>
        )}
      </div>

      {/* ── 路径面包屑 / 编辑输入 ── */}
      {!editing ? (
        <div
          className="flex items-center gap-0.5 flex-1 text-xs cursor-pointer min-w-0"
          onClick={handleEditStart}
        >
          {segments.map((seg, i) => (
            <span key={i} className="flex items-center gap-0.5 min-w-0">
              {i > 0 && <VscChevronRight size={10} className="text-text-tertiary shrink-0" />}
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  handleSegmentClick(i);
                }}
                className="px-1 py-0.5 rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors cursor-pointer truncate"
              >
                {seg}
              </span>
            </span>
          ))}
          <span className="ml-auto text-text-tertiary hover:text-text-secondary shrink-0">
            <VscEdit size={12} />
          </span>
        </div>
      ) : (
        <input
          autoFocus
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleEditSubmit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleEditSubmit();
            if (e.key === 'Escape') setEditing(false);
          }}
          className="flex-1 bg-bg-raised border border-accent rounded px-2 py-0.5 text-xs
                     text-text-primary outline-none font-mono"
        />
      )}
    </div>
  );
}
