import { memo, useRef, useEffect } from 'react';
import { VscFile, VscFolder } from 'react-icons/vsc';
import type { FileEntry } from '../../../shared/types';

interface Props {
  entry: FileEntry;
  isSelected: boolean;
  editing?: boolean;
  onRenameCommit?: (newName: string) => void;
  onRenameCancel?: () => void;
  onClick: (entry: FileEntry) => void;
  onDoubleClick: (entry: FileEntry) => void;
  onContextMenu?: (e: React.MouseEvent, entry: FileEntry) => void;
}

const TYPE_LABELS: Record<string, string> = {
  '.js': 'JavaScript', '.jsx': 'React JSX', '.ts': 'TypeScript',
  '.tsx': 'React TSX', '.json': 'JSON', '.html': 'HTML',
  '.css': 'CSS', '.md': 'Markdown', '.py': 'Python', '.java': 'Java',
  '.cs': 'C#', '.xml': 'XML', '.yaml': 'YAML', '.yml': 'YAML',
  '.svg': 'SVG 图形', '.txt': '文本文件', '.sql': 'SQL',
  '.sh': 'Shell', '.ps1': 'PowerShell', '.toml': 'TOML',
  '.ini': '配置文件', '.rs': 'Rust', '.go': 'Go',
  '.rb': 'Ruby', '.php': 'PHP', '.c': 'C 源文件', '.cpp': 'C++',
  '.h': 'C 头文件', '.scss': 'SCSS', '.less': 'Less',
};

function getTypeLabel(entry: FileEntry): string {
  if (entry.isDirectory) return '文件夹';
  return TYPE_LABELS[entry.extension] || entry.extension.slice(1).toUpperCase() + ' 文件';
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(1)} GB`;
}

export const FileRow = memo(function FileRow({ entry, isSelected, editing, onRenameCommit, onRenameCancel, onClick, onDoubleClick, onContextMenu }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  // 进入编辑模式时自动聚焦并选中文件名（不含扩展名）
  useEffect(() => {
    if (editing && inputRef.current) {
      const input = inputRef.current;
      input.focus();
      // 选中基础名（不含扩展名）
      const dotIdx = entry.name.lastIndexOf('.');
      if (dotIdx > 0) {
        input.setSelectionRange(0, dotIdx);
      } else {
        input.select();
      }
    }
  }, [editing]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onRenameCommit?.(inputRef.current?.value ?? entry.name);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onRenameCancel?.();
    }
  };

  const handleBlur = () => {
    if (inputRef.current) {
      onRenameCommit?.(inputRef.current.value);
    }
  };

  return (
    <div
      className={`file-row flex items-center gap-2 px-3 py-1.5 cursor-pointer text-xs select-none
        ${isSelected ? 'bg-accent/15 text-text-primary' : 'text-text-secondary'}`}
      onClick={() => !editing && onClick(entry)}
      onDoubleClick={() => !editing && onDoubleClick(entry)}
      onContextMenu={(e) => onContextMenu?.(e, entry)}
    >
      {entry.isDirectory ? (
        <VscFolder size={15} className="text-accent flex-shrink-0" />
      ) : (
        <VscFile size={15} className="text-text-tertiary flex-shrink-0" />
      )}

      {/* Feature #2: 行内重命名模式 */}
      {editing ? (
        <input
          ref={inputRef}
          defaultValue={entry.name}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 bg-bg-base border border-accent rounded px-1 py-0 text-xs text-text-primary outline-none"
        />
      ) : (
        <span className="flex-1 font-medium truncate" title={entry.name}>{entry.name}</span>
      )}

      <span className="w-16 text-right tabular-nums text-text-tertiary">
        {entry.isDirectory ? '—' : formatSize(entry.size)}
      </span>
      <span className="w-20 text-right text-text-tertiary truncate">
        {getTypeLabel(entry)}
      </span>
      <span className="w-36 text-right text-text-tertiary">
        {entry.modified}
      </span>
    </div>
  );
});
