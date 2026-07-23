import { useEffect, useRef } from 'react';

interface Props {
  x: number;
  y: number;
  onSelect: (ext: string) => void;
  onClose: () => void;
}

export const FILE_TYPES: { label: string; ext: string }[] = [
  { label: 'Text (.txt)', ext: '.txt' },
  { label: 'Markdown (.md)', ext: '.md' },
  { label: 'JavaScript (.js)', ext: '.js' },
  { label: 'TypeScript (.ts)', ext: '.ts' },
  { label: 'JSON (.json)', ext: '.json' },
  { label: 'HTML (.html)', ext: '.html' },
  { label: 'CSS (.css)', ext: '.css' },
  { label: 'Python (.py)', ext: '.py' },
  { label: 'Java (.java)', ext: '.java' },
  { label: 'C (.c)', ext: '.c' },
  { label: 'C++ (.cpp)', ext: '.cpp' },
  { label: 'XML (.xml)', ext: '.xml' },
  { label: 'YAML (.yaml)', ext: '.yaml' },
  { label: 'SQL (.sql)', ext: '.sql' },
  { label: 'Shell (.sh)', ext: '.sh' },
  { label: 'Batch (.bat)', ext: '.bat' },
  { label: 'INI (.ini)', ext: '.ini' },
  { label: 'Log (.log)', ext: '.log' },
];

export function NewFileTypePicker({ x, y, onSelect, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const frame = requestAnimationFrame(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEsc);
    });
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  const adjustedX = Math.min(x, window.innerWidth - 240);
  const adjustedY = Math.min(y, window.innerHeight - FILE_TYPES.length * 28 - 16);

  return (
    <div
      ref={ref}
      className="fixed z-[101] min-w-[220px] bg-bg-raised border border-border-subtle
                 rounded-lg shadow-xl py-1 text-xs max-h-[400px] overflow-y-auto"
      style={{ left: adjustedX, top: adjustedY }}
    >
      <div className="px-3 py-1.5 text-[10px] text-text-tertiary border-b border-border-subtle font-medium">
        选择文件类型
      </div>
      {FILE_TYPES.map((ft) => (
        <button
          key={ft.ext}
          onClick={() => onSelect(ft.ext)}
          className="w-full flex items-center justify-between px-3 py-1.5 text-left
                     text-text-secondary hover:bg-bg-hover hover:text-text-primary
                     transition-colors"
        >
          <span>{ft.label}</span>
          <span className="text-[10px] text-text-tertiary">{ft.ext}</span>
        </button>
      ))}
    </div>
  );
}
