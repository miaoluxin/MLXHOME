import { useEffect, useRef } from 'react';

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  divider?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      onClose();
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    // 延迟一帧避免触发打开菜单时的 mousedown
    const frame = requestAnimationFrame(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('contextmenu', handleContextMenu);
      document.addEventListener('keydown', handleEsc);
    });

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  // 确保菜单不超出窗口边界
  const adjustedX = Math.min(x, window.innerWidth - 200);
  const adjustedY = Math.min(y, window.innerHeight - items.length * 32 - 16);

  return (
    <div
      ref={ref}
      className="fixed z-[100] min-w-[180px] bg-bg-raised border border-border-subtle
                 rounded-lg shadow-xl py-1 text-xs"
      style={{ left: adjustedX, top: adjustedY }}
    >
      {items.map((item, i) => (
        item.divider ? (
          <div key={i} className="h-px bg-border-subtle my-1" />
        ) : (
          <button
            key={i}
            disabled={item.disabled}
            onClick={() => { item.onClick(); onClose(); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-left
                       text-text-secondary hover:bg-bg-hover hover:text-text-primary
                       disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
            <span className="flex-1">{item.label}</span>
          </button>
        )
      ))}
    </div>
  );
}
