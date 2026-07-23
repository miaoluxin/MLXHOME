import { useState, useRef, useCallback, useEffect } from 'react';
import { VscGlobe, VscClose, VscArrowLeft, VscArrowRight, VscRefresh, VscStarFull, VscBookmark, VscHome } from 'react-icons/vsc';
import { DraggablePanelHeader } from '../layout/DraggablePanelHeader';
import { useLayoutStore } from '../../stores/useLayoutStore';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      webview: any;
    }
  }
}

interface Bookmark {
  name: string;
  url: string;
  addedAt: number;
}

const BOOKMARKS_KEY = 'mlx-browser-bookmarks';
const HOMEPAGE_KEY = 'mlx-browser-homepage';

export function BrowserTool() {
  const [url, setUrl] = useState('');
  const [currentUrl, setCurrentUrl] = useState('about:blank');
  const webviewRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);

  // ── 收藏夹 & 首页 ──
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => {
    try { return JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || '[]'); }
    catch { return []; }
  });
  const [homepage, setHomepage] = useState<string>(() => {
    try { return localStorage.getItem(HOMEPAGE_KEY) || ''; }
    catch { return ''; }
  });
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showHomepageInput, setShowHomepageInput] = useState(false);
  const [homepageInput, setHomepageInput] = useState('');
  const [initialNavDone, setInitialNavDone] = useState(false);

  // 持久化收藏夹
  const saveBookmarks = (b: Bookmark[]) => {
    setBookmarks(b);
    try { localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(b)); } catch { /* ignore */ }
  };

  const addBookmark = () => {
    if (!currentUrl || currentUrl === 'about:blank') return;
    if (bookmarks.find(b => b.url === currentUrl)) return; // 已存在
    const name = title || currentUrl.substring(0, 60);
    saveBookmarks([...bookmarks, { name, url: currentUrl, addedAt: Date.now() }]);
  };

  const removeBookmark = (bookmarkUrl: string) => {
    saveBookmarks(bookmarks.filter(b => b.url !== bookmarkUrl));
  };

  const setHomepageUrl = (hpUrl: string) => {
    setHomepage(hpUrl);
    try { localStorage.setItem(HOMEPAGE_KEY, hpUrl); } catch { /* ignore */ }
  };

  const saveHomepage = () => {
    let hpUrl = homepageInput.trim();
    if (hpUrl && !/^https?:\/\//i.test(hpUrl) && hpUrl !== 'about:blank') {
      hpUrl = 'https://' + hpUrl;
    }
    setHomepageUrl(hpUrl);
    setShowHomepageInput(false);
  };

  const navigate = useCallback((targetUrl?: string) => {
    const dest = targetUrl || url.trim();
    if (!dest) return;
    let formattedUrl = dest;
    if (!/^https?:\/\//i.test(formattedUrl) && !formattedUrl.startsWith('about:')) {
      formattedUrl = 'https://' + formattedUrl;
    }
    setUrl(formattedUrl);
    const wv = webviewRef.current;
    if (wv) {
      try {
        wv.loadURL(formattedUrl);
      } catch { /* ignore */ }
    }
  }, [url]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      navigate();
      setTimeout(() => webviewRef.current?.focus(), 50);
    }
  };

  const handleWebviewRef = useCallback((node: any) => {
    if (!node) return;
    webviewRef.current = node;

    const onNavigated = (e: any) => {
      setCurrentUrl(e.url);
      setUrl(e.url);
      setCanGoBack(node.canGoBack?.() ?? false);
      setCanGoForward(node.canGoForward?.() ?? false);
    };

    const onPageTitleUpdated = (e: any) => {
      setTitle(e.title);
    };

    const onLoadingStart = () => setLoading(true);
    const onLoadingStop = () => setLoading(false);

    node.addEventListener('did-navigate', onNavigated);
    node.addEventListener('did-navigate-in-page', onNavigated);
    node.addEventListener('page-title-updated', onPageTitleUpdated);
    node.addEventListener('did-start-loading', onLoadingStart);
    node.addEventListener('did-stop-loading', onLoadingStop);
    node.addEventListener('dom-ready', () => {
      node.focus();
      // 首次加载时导航到首页
      if (!initialNavDone && homepage) {
        setInitialNavDone(true);
        setUrl(homepage);
        try { node.loadURL(homepage); } catch { /* ignore */ }
      }
      setInitialNavDone(true);
    });
  }, [homepage, initialNavDone]);

  // 点击地址栏时阻止webview偷走焦点
  const handleInputFocus = () => {
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  // 文档外部点击关闭下拉
  useEffect(() => {
    const handleClickOutside = () => {
      setShowBookmarks(false);
      setShowHomepageInput(false);
    };
    if (showBookmarks || showHomepageInput) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showBookmarks, showHomepageInput]);

  const isBookmarked = bookmarks.some(b => b.url === currentUrl);

  return (
    <div className="h-full flex flex-col glass-panel overflow-hidden">
      <DraggablePanelHeader panelId="browser" className="flex items-center justify-between px-3 py-2 border-b border-border-subtle flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <VscGlobe size={15} className="text-accent flex-shrink-0" />
          <span className="text-xs font-medium text-text-secondary truncate">{title || '浏览器'}</span>
        </div>
        <button onClick={() => useLayoutStore.getState().setShowBrowser(false)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-500/20 text-text-secondary hover:text-red-400 transition-colors flex-shrink-0" title="关闭">
          <VscClose size={16} />
        </button>
      </DraggablePanelHeader>

      {/* ── 工具栏 ── */}
      <div className="flex items-center gap-1 px-2 py-1 border-b border-border-subtle flex-shrink-0">
        <button onClick={() => webviewRef.current?.goBack()} disabled={!canGoBack} className="w-6 h-6 flex items-center justify-center rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors flex-shrink-0" style={!canGoBack ? { opacity: 0.3 } : undefined} title="后退">
          <VscArrowLeft size={14} />
        </button>
        <button onClick={() => webviewRef.current?.goForward()} disabled={!canGoForward} className="w-6 h-6 flex items-center justify-center rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors flex-shrink-0" style={!canGoForward ? { opacity: 0.3 } : undefined} title="前进">
          <VscArrowRight size={14} />
        </button>
        <button onClick={() => webviewRef.current?.reload()} className="w-6 h-6 flex items-center justify-center rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors flex-shrink-0" title="刷新">
          <VscRefresh size={14} className={loading ? 'animate-spin' : ''} />
        </button>

        {/* 收藏夹星标 */}
        <button onClick={addBookmark} className={`w-6 h-6 flex items-center justify-center rounded hover:bg-bg-hover transition-colors flex-shrink-0 ${isBookmarked ? 'text-yellow-400' : 'text-text-secondary hover:text-yellow-400'}`} title={isBookmarked ? '已收藏' : '添加收藏'} disabled={!currentUrl || currentUrl === 'about:blank'}>
          <VscStarFull size={14} />
        </button>

        {/* 主页按钮 */}
        {homepage && (
          <button onClick={() => { setUrl(homepage); navigate(homepage); }} className="w-6 h-6 flex items-center justify-center rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors flex-shrink-0" title={`主页: ${homepage}`}>
            <VscHome size={14} />
          </button>
        )}

        {/* 书签下拉 */}
        <div className="relative flex-shrink-0">
          <button onClick={(e) => { e.stopPropagation(); setShowBookmarks(!showBookmarks); setShowHomepageInput(false); }} className="w-6 h-6 flex items-center justify-center rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors" title="书签">
            <VscBookmark size={14} />
          </button>
          {showBookmarks && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-bg-raised border border-border-subtle rounded-lg shadow-xl z-50 max-h-72 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-border-subtle sticky top-0 bg-bg-raised">
                <span className="text-[10px] font-medium text-text-secondary">书签</span>
                <button onClick={() => { setShowHomepageInput(!showHomepageInput); }} className="text-[10px] text-text-tertiary hover:text-accent" title="主页设置">
                  {homepage ? '修改首页' : '设置首页'}
                </button>
              </div>
              {showHomepageInput && (
                <div className="px-3 py-2 border-b border-border-subtle bg-bg-base">
                  <div className="text-[10px] text-text-tertiary mb-1">主页 URL</div>
                  <div className="flex gap-1">
                    <input
                      value={homepageInput}
                      onChange={(e) => setHomepageInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveHomepage(); }}
                      className="flex-1 bg-bg-deep border border-border-subtle rounded px-2 py-0.5 text-[10px] text-text-primary outline-none"
                      placeholder={homepage || 'https://...'}
                    />
                    <button onClick={saveHomepage} className="px-2 py-0.5 text-[10px] bg-accent/10 text-accent rounded hover:bg-accent/20">保存</button>
                  </div>
                </div>
              )}
              {bookmarks.length === 0 ? (
                <div className="px-3 py-3 text-[10px] text-text-tertiary text-center">暂无书签 — 点击 ★ 添加</div>
              ) : (
                bookmarks.sort((a, b) => b.addedAt - a.addedAt).map((bm) => (
                  <div key={bm.url} className="flex items-center justify-between px-3 py-1.5 hover:bg-bg-hover group cursor-pointer">
                    <button
                      onClick={() => { setUrl(bm.url); navigate(bm.url); setShowBookmarks(false); }}
                      className="flex-1 min-w-0 text-left"
                    >
                      <div className="text-[10px] text-text-primary truncate">{bm.name}</div>
                      <div className="text-[10px] text-text-tertiary truncate">{bm.url}</div>
                    </button>
                    <button onClick={() => removeBookmark(bm.url)} className="w-4 h-4 hidden group-hover:flex items-center justify-center rounded hover:bg-red-500/20 text-text-tertiary hover:text-red-400 flex-shrink-0 ml-1" title="删除">
                      <VscClose size={10} />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* 地址栏 */}
        <input
          ref={inputRef}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={handleInputFocus}
          className="flex-1 bg-bg-base border border-border-subtle rounded px-2 py-1 text-xs text-text-primary outline-none focus:border-accent min-w-0"
          placeholder="输入网址后按 Enter..."
          spellCheck={false}
        />
      </div>

      {/* ── Webview 内容区 ── */}
      <div className="flex-1 relative overflow-hidden bg-white">
        <webview
          ref={handleWebviewRef}
          src={homepage || 'about:blank'}
          style={{ width: '100%', height: '100%', border: 'none', display: 'flex' }}
        />
      </div>
    </div>
  );
}
