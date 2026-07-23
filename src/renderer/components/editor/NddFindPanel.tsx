import { useState, useCallback } from 'react';
import { VscClose, VscCaseSensitive, VscWholeWord, VscRegex } from 'react-icons/vsc';

interface NddFindPanelProps {
  onClose: () => void;
  onFind: (query: string, opt: FindOptions) => void;
  onFindNext: () => void;
  onFindPrev: () => void;
  onReplace: (replaceText: string) => void;
  onReplaceAll: (replaceText: string) => void;
  matchCount?: number;
  initialShowReplace?: boolean;
}

export interface FindOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  useRegex: boolean;
}

export function NddFindPanel({
  onClose,
  onFind,
  onFindNext,
  onFindPrev,
  onReplace,
  onReplaceAll,
  matchCount,
  initialShowReplace = false,
}: NddFindPanelProps) {
  const [query, setQuery] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [options, setOptions] = useState<FindOptions>({
    caseSensitive: false,
    wholeWord: false,
    useRegex: false,
  });
  const [showReplace, setShowReplace] = useState(initialShowReplace);

  const toggleOption = useCallback((key: keyof FindOptions) => {
    setOptions((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      return next;
    });
  }, []);

  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setQuery(val);
      onFind(val, options);
    },
    [onFind, options]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          onFindPrev();
        } else {
          onFindNext();
        }
      }
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onFindNext, onFindPrev, onClose]
  );

  return (
    <div className="flex flex-col bg-bg-deep border-b border-border-subtle text-xs select-none">
      {/* 查找行 */}
      <div className="flex items-center gap-1.5 px-3 py-1.5">
        <span className="text-text-tertiary w-8 text-right shrink-0">
          {showReplace ? '查找' : '查找'}
        </span>
        <input
          type="text"
          value={query}
          onChange={handleQueryChange}
          onKeyDown={handleKeyDown}
          placeholder="输入搜索内容..."
          className="flex-1 min-w-0 px-2 py-1 bg-bg-base border border-border-subtle rounded
                     text-text-primary text-xs
                     focus:outline-none focus:border-accent
                     placeholder:text-text-tertiary"
          autoFocus
        />

        {/* 选项按钮 */}
        <button
          onClick={() => toggleOption('caseSensitive')}
          className={`p-1 rounded transition-colors ${
            options.caseSensitive
              ? 'bg-accent text-white'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
          }`}
          title="大小写匹配 (Aa)"
        >
          <VscCaseSensitive size={14} />
        </button>
        <button
          onClick={() => toggleOption('wholeWord')}
          className={`p-1 rounded transition-colors ${
            options.wholeWord
              ? 'bg-accent text-white'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
          }`}
          title="全词匹配 (W)"
        >
          <VscWholeWord size={14} />
        </button>
        <button
          onClick={() => toggleOption('useRegex')}
          className={`p-1 rounded transition-colors ${
            options.useRegex
              ? 'bg-accent text-white'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
          }`}
          title="正则表达式 (.*)"
        >
          <VscRegex size={14} />
        </button>

        <div className="w-px h-4 bg-border-subtle mx-0.5" />

        {/* 操作按钮 */}
        <button
          onClick={onFindPrev}
          className="px-2 py-1 rounded text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
          title="查找上一个 (Shift+Enter)"
        >
          上一个
        </button>
        <button
          onClick={onFindNext}
          className="px-2 py-1 rounded bg-accent text-white hover:bg-accent-hover transition-colors"
          title="查找下一个 (Enter)"
        >
          下一个
        </button>

        {/* 匹配计数 */}
        {matchCount !== undefined && (
          <span className="text-text-tertiary ml-1">
            {matchCount} 个匹配
          </span>
        )}

        {/* 展开替换 */}
        <button
          onClick={() => setShowReplace((v) => !v)}
          className={`px-2 py-1 rounded transition-colors ${
            showReplace
              ? 'bg-bg-hover text-text-primary'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
          }`}
          title="替换模式"
        >
          替换
        </button>

        {/* 关闭 */}
        <button
          onClick={onClose}
          className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
          title="关闭 (Esc)"
        >
          <VscClose size={14} />
        </button>
      </div>

      {/* 替换行 */}
      {showReplace && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 pb-2 border-t border-border-subtle">
          <span className="text-text-tertiary w-8 text-right shrink-0">
            替换
          </span>
          <input
            type="text"
            value={replaceText}
            onChange={(e) => setReplaceText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onReplace(replaceText);
              }
              if (e.key === 'Escape') {
                onClose();
              }
            }}
            placeholder="替换为..."
            className="flex-1 min-w-0 px-2 py-1 bg-bg-base border border-border-subtle rounded
                       text-text-primary text-xs
                       focus:outline-none focus:border-accent
                       placeholder:text-text-tertiary"
          />
          <button
            onClick={() => onReplace(replaceText)}
            className="px-2 py-1 rounded text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
            title="替换当前 (Enter)"
          >
            替换
          </button>
          <button
            onClick={() => onReplaceAll(replaceText)}
            className="px-2 py-1 rounded text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
            title="全部替换"
          >
            全部替换
          </button>
        </div>
      )}
    </div>
  );
}
