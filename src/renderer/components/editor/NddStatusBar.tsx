import { useCallback } from 'react';

interface NddStatusBarProps {
  language: string;
  encoding: string;
  lineEnding: 'CRLF' | 'LF' | 'CR';
  cursorLine: number;
  cursorCol: number;
  zoomLevel: number;
  isReadOnly: boolean;
  columnMode?: boolean;
  fileSize?: string;   // 可读的文件大小，如 "2.3KB"
  onEncodingChange?: (enc: string) => void;
  onLineEndingChange?: (le: 'CRLF' | 'LF' | 'CR') => void;
  onZoomChange?: (level: number) => void;
}

const ENCODINGS = [
  { value: 'utf-8', label: 'UTF-8' },
  { value: 'utf-16le', label: 'UTF-16 LE' },
  { value: 'gbk', label: 'GBK' },
  { value: 'big5', label: 'Big5' },
  { value: 'shift-jis', label: 'Shift-JIS' },
  { value: 'euc-kr', label: 'EUC-KR' },
  { value: 'iso-8859-1', label: 'ISO-8859-1' },
];

const LINE_ENDINGS: { value: 'CRLF' | 'LF' | 'CR'; label: string }[] = [
  { value: 'LF', label: 'LF' },
  { value: 'CRLF', label: 'CRLF' },
  { value: 'CR', label: 'CR' },
];

const LINE_ENDING_TOOLTIPS: Record<string, string> = {
  CRLF: 'Windows (CRLF)',
  LF: 'Unix (LF)',
  CR: 'Mac (CR)',
};

export function NddStatusBar({
  language,
  encoding,
  lineEnding,
  cursorLine,
  cursorCol,
  zoomLevel,
  isReadOnly,
  columnMode,
  fileSize,
  onEncodingChange,
  onLineEndingChange,
  onZoomChange,
}: NddStatusBarProps) {
  const handleZoomClick = useCallback(() => {
    // Ctrl+滚轮已由 editor 处理，这里只显示
  }, []);

  return (
    <div className="flex items-center justify-between px-3 py-0.5 bg-bg-deep border-t border-border-subtle text-[11px] text-text-tertiary select-none shrink-0 min-h-[22px]">
      {/* 左侧：光标位置 + 语言 */}
      <div className="flex items-center gap-3">
        <span className="text-text-secondary tabular-nums">
          行 {cursorLine}, 列 {cursorCol + 1}
        </span>

        {isReadOnly && (
          <>
            <span className="text-border-subtle">|</span>
            <span className="text-yellow-400">只读</span>
          </>
        )}
      </div>

      {/* 右侧：信息 */}
      <div className="flex items-center gap-3">
        {/* 文件大小 */}
        {fileSize && (
          <>
            <span>{fileSize}</span>
            <span className="text-border-subtle">|</span>
          </>
        )}

        {/* 语言 */}
        <span className="text-text-secondary">{language}</span>

        {/* 列模式指示灯 */}
        {columnMode && (
          <>
            <span className="text-border-subtle">|</span>
            <span className="text-accent font-medium">列模式</span>
          </>
        )}

        <span className="text-border-subtle">|</span>

        {/* 编码选择 */}
        <select
          value={encoding}
          onChange={(e) => onEncodingChange?.(e.target.value)}
          className="bg-transparent text-text-tertiary hover:text-text-primary cursor-pointer
                     border-none focus:outline-none text-[11px] appearance-none"
          title="编码"
        >
          {ENCODINGS.map((enc) => (
            <option key={enc.value} value={enc.value}>
              {enc.label}
            </option>
          ))}
        </select>

        {/* 换行符选择 */}
        <select
          value={lineEnding}
          onChange={(e) => onLineEndingChange?.(e.target.value as 'CRLF' | 'LF' | 'CR')}
          className="bg-transparent text-text-tertiary hover:text-text-primary cursor-pointer
                     border-none focus:outline-none text-[11px] appearance-none"
          title={LINE_ENDING_TOOLTIPS[lineEnding] || lineEnding}
        >
          {LINE_ENDINGS.map((le) => (
            <option key={le.value} value={le.value}>
              {le.label}
            </option>
          ))}
        </select>

        <span className="text-border-subtle">|</span>

        {/* 缩放 */}
        <span className="tabular-nums" title="Ctrl+滚轮缩放">
          {zoomLevel}%
        </span>
      </div>
    </div>
  );
}
