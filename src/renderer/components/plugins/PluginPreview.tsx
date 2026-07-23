import { useState, useEffect, useRef, useCallback } from 'react';
import { VscClose, VscRefresh } from 'react-icons/vsc';
import { getPreviewRenderer } from '../../plugin-system/plugin-api';

interface PluginPreviewProps {
  language: string;
  content: string;
  title: string;
  onClose: () => void;
}

export function PluginPreview({ language, content, title, onClose }: PluginPreviewProps) {
  const [html, setHtml] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const timerRef = useRef<number | null>(null);

  const render = useCallback(async () => {
    const renderer = getPreviewRenderer(language);
    if (!renderer) {
      setError(`没有找到 ${language} 的预览渲染器`);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await renderer(content);
      setHtml(result);
    } catch (err: any) {
      setError(err.message || '渲染失败');
    } finally {
      setLoading(false);
    }
  }, [language, content]);

  // 内容变化后 500ms 防抖重新渲染
  useEffect(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      render();
    }, 500);
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [render]);

  return (
    <div className="h-full flex flex-col bg-bg-deep border-l border-border-subtle">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          <span className="font-medium">{title}</span>
          {loading && <span className="text-text-tertiary animate-pulse">刷新中...</span>}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={render}
            className="p-1 rounded hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors"
            title="重新渲染"
          >
            <VscRefresh size={14} />
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors"
            title="关闭预览"
          >
            <VscClose size={14} />
          </button>
        </div>
      </div>

      {/* 渲染内容 */}
      <div className="flex-1 overflow-hidden">
        {error ? (
          <div className="p-4 text-sm text-red-400 bg-red-400/5">{error}</div>
        ) : loading ? (
          <div className="flex items-center justify-center h-full text-text-tertiary text-sm">
            <span className="animate-pulse">渲染中...</span>
          </div>
        ) : html ? (
          <iframe
            ref={iframeRef}
            srcDoc={html}
            className="w-full h-full border-none"
            sandbox="allow-scripts"
            title="plugin-preview"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-text-tertiary text-sm">
            <span>等待内容...</span>
          </div>
        )}
      </div>
    </div>
  );
}
