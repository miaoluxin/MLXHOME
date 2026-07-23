import { useState, useRef, useCallback, useEffect } from 'react';
import { VscSearch, VscClose, VscFileCode, VscFolderOpened, VscCopy, VscLoading } from 'react-icons/vsc';
import { DraggablePanelHeader } from '../layout/DraggablePanelHeader';
import { useProjectStore } from '../../stores/useProjectStore';
import { useLayoutStore } from '../../stores/useLayoutStore';
import { useFileStore } from '../../stores/useFileStore';
import { useEditorStore } from '../../stores/useEditorStore';

interface SearchMatch {
  file: string;
  line: number;
  column: number;
  lineContent: string;
}

export function ContentSearch() {
  const projectPath = useProjectStore((s) => s.projectPath);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [grouped, setGrouped] = useState<Record<string, SearchMatch[]>>({});
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSearch = useCallback((q: string) => {
    setQuery(q);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (q.length < 2) { setResults([]); setGrouped({}); return; }
    timerRef.current = window.setTimeout(async () => {
      if (!projectPath) return;
      setSearching(true);
      try {
        const matches = await window.electronAPI.contentSearch.search(projectPath, q);
        setResults(matches);
        const g: Record<string, SearchMatch[]> = {};
        for (const m of matches) {
          if (!g[m.file]) g[m.file] = [];
          g[m.file].push(m);
        }
        setGrouped(g);
        setExpandedFiles(new Set(Object.keys(g).slice(0, 5)));
      } catch { setResults([]); setGrouped({}); }
      setSearching(false);
    }, 400);
  }, [projectPath]);

  const openFile = async (filePath: string, line: number) => {
    try {
      const content = await window.electronAPI.fs.read(filePath);
      const editorStore = useEditorStore.getState();
      editorStore.openFile(filePath, content);
    } catch {
      const dir = filePath.replace(/\\/g, '/').substring(0, filePath.replace(/\\/g, '/').lastIndexOf('/'));
      useFileStore.getState().setCurrentPath(dir);
      useLayoutStore.getState().setShowFileBrowser(true);
    }
  };

  const toggleFile = (file: string) => {
    setExpandedFiles(prev => {
      const next = new Set(prev);
      if (next.has(file)) next.delete(file); else next.add(file);
      return next;
    });
  };

  return (
    <div className="h-full flex flex-col glass-panel overflow-hidden">
      <DraggablePanelHeader panelId="contentSearch" className="flex items-center justify-between px-3 py-2 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <VscSearch size={15} className="text-accent" />
          <span className="text-xs font-medium text-text-secondary">内容搜索</span>
        </div>
        <button onClick={() => useLayoutStore.getState().setShowContentSearch(false)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-500/20 text-text-secondary hover:text-red-400 transition-colors">
          <VscClose size={16} />
        </button>
      </DraggablePanelHeader>

      <div className="px-3 py-2 border-b border-border-subtle">
        <div className="relative">
          <VscSearch size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input ref={inputRef} type="text" value={query} onChange={(e) => handleSearch(e.target.value)}
            placeholder="搜索文件内容... (至少2字符)"
            className="w-full bg-bg-raised border border-border-subtle rounded-md pl-8 pr-3 py-1.5 text-xs text-text-primary placeholder-text-tertiary outline-none focus:border-accent transition-colors" />
          {query && <button onClick={() => { setQuery(''); setResults([]); setGrouped({}); inputRef.current?.focus(); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"><VscClose size={12} /></button>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {searching ? (
          <div className="flex items-center justify-center py-8 text-text-tertiary text-xs gap-2">
            <VscLoading size={14} className="animate-spin" /> 搜索中...
          </div>
        ) : !query ? (
          <div className="flex items-center justify-center py-8 text-text-tertiary text-xs">输入关键词搜索项目文件内容</div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="flex items-center justify-center py-8 text-text-tertiary text-xs">未找到匹配的内容</div>
        ) : (
          Object.entries(grouped).map(([file, matches]) => (
            <div key={file}>
              <div className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-bg-hover text-xs text-text-secondary border-b border-border-subtle"
                onClick={() => toggleFile(file)}>
                <VscFileCode size={14} className="text-blue-400 flex-shrink-0" />
                <span className="flex-1 truncate">{file.split('/').pop() || file.split('\\').pop()}</span>
                <span className="text-[10px] text-text-tertiary">{matches.length} 处</span>
                <VscCopy size={12} className="opacity-0 hover:opacity-100 cursor-pointer" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(file); }} />
              </div>
              {expandedFiles.has(file) && matches.map((m, i) => (
                <div key={i} className="flex items-start gap-2 px-3 py-1 cursor-pointer hover:bg-bg-hover text-[10px] ml-6 border-b border-border-subtle/50"
                  onClick={() => openFile(m.file, m.line)}>
                  <span className="text-text-tertiary w-8 flex-shrink-0 text-right">{m.line}</span>
                  <span className="text-text-primary truncate flex-1">{m.lineContent}</span>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {results.length > 0 && (
        <div className="px-3 py-1.5 border-t border-border-subtle bg-bg-deep text-[10px] text-text-tertiary">
          共 {results.length} 条匹配结果
        </div>
      )}
    </div>
  );
}
