import { useMemo, useState, useCallback } from 'react';
import { VscArrowLeft, VscArrowRight, VscSymbolRuler } from 'react-icons/vsc';

const BYTES_PER_ROW = 16;
const ROWS_PER_PAGE = 64; // 64 rows per page = 1024 bytes

interface NddHexViewerProps {
  /** 文件文本内容（将为 UTF-8 编码后显示十六进制） */
  content: string;
  onClose: () => void;
}

/** 将字符串编码为 UTF-8 字节数组 */
function stringToUtf8Bytes(str: string): number[] {
  const encoder = new TextEncoder();
  return Array.from(encoder.encode(str));
}

export function NddHexViewer({ content, onClose }: NddHexViewerProps) {
  const bytes = useMemo(() => stringToUtf8Bytes(content), [content]);
  const totalRows = Math.ceil(bytes.length / BYTES_PER_ROW);
  const totalPages = Math.max(1, Math.ceil(totalRows / ROWS_PER_PAGE));
  const [page, setPage] = useState(0);
  const [gotoOffset, setGotoOffset] = useState('');

  const pageStart = page * ROWS_PER_PAGE;
  const visibleRows = useMemo(() => {
    const rows: { addr: string; hex: string[]; ascii: string }[] = [];
    const end = Math.min(pageStart + ROWS_PER_PAGE, totalRows);
    for (let row = pageStart; row < end; row++) {
      const start = row * BYTES_PER_ROW;
      const rowBytes = bytes.slice(start, start + BYTES_PER_ROW);
      const addr = start.toString(16).padStart(8, '0');
      const hex: string[] = [];
      let ascii = '';
      for (let i = 0; i < BYTES_PER_ROW; i++) {
        if (i < rowBytes.length) {
          const b = rowBytes[i];
          hex.push(b.toString(16).padStart(2, '0'));
          ascii += b >= 32 && b <= 126 ? String.fromCharCode(b) : '.';
        } else {
          hex.push('  ');
        }
      }
      // 在每8个字节后加空格分组
      hex.splice(8, 0, '');
      rows.push({ addr, hex, ascii });
    }
    return rows;
  }, [bytes, pageStart, totalRows]);

  const handlePrev = useCallback(() => setPage((p) => Math.max(0, p - 1)), []);
  const handleNext = useCallback(() => setPage((p) => Math.min(totalPages - 1, p + 1)), [totalPages]);

  const handleGoto = useCallback(() => {
    const offset = parseInt(gotoOffset, 16);
    if (isNaN(offset) || offset < 0 || offset >= bytes.length) return;
    const targetPage = Math.floor(offset / BYTES_PER_ROW / ROWS_PER_PAGE);
    setPage(targetPage);
    setGotoOffset('');
  }, [gotoOffset, bytes.length]);

  if (bytes.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-text-tertiary text-sm bg-bg-deep">
        无十六进制数据
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-bg-deep font-mono text-xs">
      {/* ── 表头 ── */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border-subtle bg-bg-base shrink-0">
        <VscSymbolRuler size={14} className="text-accent" />
        <span className="text-text-secondary text-[11px] font-sans">十六进制查看器</span>
        <span className="text-text-tertiary text-[11px] font-sans">— {bytes.length} 字节</span>
        <div className="flex-1" />
        <span className="text-text-tertiary text-[11px] font-sans">页 {page + 1}/{totalPages}</span>
        <button onClick={handlePrev} disabled={page === 0}
          className="p-0.5 rounded text-text-secondary hover:text-text-primary hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed">
          <VscArrowLeft size={12} />
        </button>
        <button onClick={handleNext} disabled={page >= totalPages - 1}
          className="p-0.5 rounded text-text-secondary hover:text-text-primary hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed">
          <VscArrowRight size={12} />
        </button>
        <div className="flex items-center gap-1 ml-2">
          <input type="text" value={gotoOffset} onChange={(e) => setGotoOffset(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleGoto(); if (e.key === 'Escape') setGotoOffset(''); }}
            placeholder="偏移 (十六进制)" className="w-28 px-2 py-0.5 bg-bg-base border border-border-subtle rounded text-text-primary text-[11px] font-mono focus:outline-none focus:border-accent placeholder:text-text-tertiary" />
          <button onClick={handleGoto} className="px-1.5 py-0.5 rounded text-text-secondary hover:text-text-primary hover:bg-bg-hover text-[11px]">跳转</button>
        </div>
        <button onClick={onClose} className="p-0.5 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-hover ml-1">✕</button>
      </div>

      {/* ── 内容 ── */}
      <div className="flex-1 overflow-auto">
        {/* 列标头 */}
        <div className="flex items-center sticky top-0 bg-bg-deep border-b border-border-subtle py-1 px-3 text-[10px] text-text-tertiary">
          <span className="w-[68px] shrink-0 text-right pr-4">偏移</span>
          {Array.from({ length: 8 }, (_, i) => (<span key={i} className="w-7 text-center shrink-0">{i.toString(16)}0</span>))}
          <span className="w-3 shrink-0" />
          {Array.from({ length: 8 }, (_, i) => (<span key={i + 8} className="w-7 text-center shrink-0">{i.toString(16)}8</span>))}
          <span className="flex-1 pl-4">ASCII</span>
        </div>

        {/* 数据行 */}
        <div className="px-3 py-1">
          {visibleRows.map((row) => (
            <div key={row.addr} className="flex items-center py-[1px] hover:bg-bg-hover rounded-sm">
              <span className="w-[68px] shrink-0 text-right pr-4 text-accent select-none">{row.addr}</span>
              <div className="flex items-center gap-0">
                {row.hex.map((h, i) => (
                  <span key={i} className={`w-7 text-center shrink-0 ${h === '  ' ? 'text-transparent' : 'text-text-secondary'}`}>{h}</span>
                ))}
              </div>
              <span className="flex-1 pl-4 text-text-secondary tracking-wider">{row.ascii}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 底部 ── */}
      <div className="flex items-center px-3 py-1 border-t border-border-subtle bg-bg-base text-[10px] text-text-tertiary shrink-0 font-sans">
        <span>总计 {bytes.length} 字节</span>
        <span className="mx-2">|</span>
        <span>范围 0x00000000 – 0x{(bytes.length - 1).toString(16).padStart(8, '0')}</span>
      </div>
    </div>
  );
}
