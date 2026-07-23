import { useState, useRef, useEffect } from 'react';
import { VscAdd, VscClose } from 'react-icons/vsc';

interface Tab {
  id: string;
  label: string;
  isActive: boolean;
  createdBy?: 'local' | 'remote';
}

interface Props {
  tabs: Tab[];
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onAdd: () => void;
  onRename?: (id: string, label: string) => void;
  onEditCommitted?: () => void;
}

export function TerminalTabs({ tabs, onSelect, onClose, onAdd, onRename, onEditCommitted }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      // 使用 rAF 确保 DOM 布局完成后再聚焦
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [editingId]);

  const startEditing = (tabId: string, currentLabel: string) => {
    setEditingId(tabId);
    setEditValue(currentLabel);
  };

  const commitEdit = () => {
    if (editingId && onRename) {
      const trimmed = editValue.trim();
      if (trimmed) {
        onRename(editingId, trimmed);
      }
    }
    setEditingId(null);
    onEditCommitted?.();
  };

  const cancelEdit = () => {
    setEditingId(null);
    onEditCommitted?.();
  };

  const handleContainerClick = () => {
    if (editingId) commitEdit();
  };

  return (
    <div
      className="flex items-center bg-bg-deep border-b border-border-subtle px-1 gap-0.5 h-8"
      onClick={handleContainerClick}
    >
      {tabs.map((tab) => (
        <div
          key={tab.id}
          onClick={(e) => { e.stopPropagation(); if (editingId !== tab.id) onSelect(tab.id); }}
          className={`flex items-center gap-1.5 px-3 h-7 text-xs rounded-md cursor-pointer transition-colors
            ${tab.isActive
              ? 'bg-bg-base text-text-primary'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-raised'
            }`}
        >
          {editingId === tab.id ? (
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); commitEdit(); }
                if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancelEdit(); }
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              autoFocus
              className="bg-bg-raised border border-accent rounded px-1 py-0.5 text-xs text-text-primary w-full outline-none min-w-[60px]"
            />
          ) : (
            <span
              className="truncate max-w-[120px]"
              onDoubleClick={(e) => { e.stopPropagation(); startEditing(tab.id, tab.label); }}
            >
              {tab.label}
            </span>
          )}
          {tabs.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); onClose(tab.id); }}
              className="hover:text-red-400 transition-colors"
            >
              <VscClose size={12} />
            </button>
          )}
        </div>
      ))}
      {tabs.length === 0 && (
        <div className="flex-1 text-text-tertiary text-[10px] px-2">点击 + 新建终端</div>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onAdd(); }}
        className="p-1 hover:bg-bg-raised rounded-md text-text-secondary hover:text-text-primary transition-colors"
      >
        <VscAdd size={14} />
      </button>
    </div>
  );
}
