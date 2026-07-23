import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { useTerminalStore } from '../../stores/useTerminalStore';
import { useThemeStore } from '../../stores/useThemeStore';
import 'xterm/css/xterm.css';

interface Props {
  sessionId: string;
  onReady?: () => void;
}

export interface XTermHandle {
  focus: () => void;
  hasSelection: () => boolean;
  copySelection: () => void;
  pasteClipboard: () => void;
}

function getTerminalTheme(colors: { terminalBg: string; terminalFg: string; terminalCursor: string; accent: string }) {
  return {
    background: colors.terminalBg,
    foreground: colors.terminalFg,
    cursor: colors.terminalCursor,
    cursorAccent: colors.terminalBg,
    selectionBackground: colors.accent + '4d',
    black: colors.terminalBg,
    red: '#f7768e',
    green: '#9ece6a',
    yellow: '#e0af68',
    blue: colors.accent,
    magenta: '#bb9af7',
    cyan: '#7dcfff',
    white: colors.terminalFg,
    brightBlack: '#565f89',
    brightRed: '#ff8787',
    brightGreen: '#b9f27c',
    brightYellow: '#ff9e64',
    brightBlue: colors.accent,
    brightMagenta: '#c4a7f7',
    brightCyan: '#9de4ff',
    brightWhite: '#ffffff',
  };
}

export const XTerm = forwardRef<XTermHandle, Props>(function XTerm({ sessionId, onReady }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const sessionRef = useRef(sessionId);
  sessionRef.current = sessionId;

  useEffect(() => {
    if (!containerRef.current) return;

    let disposed = false;
    const currentColors = useThemeStore.getState().getCurrentColors();

    const terminal = new Terminal({
      theme: getTerminalTheme(currentColors),
      fontSize: 13,
      fontFamily: '"JetBrains Mono", "Cascadia Code", "Fira Code", "Consolas", monospace',
      cursorBlink: true,
      cursorStyle: 'bar',
      allowProposedApi: true,
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(containerRef.current);

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // 等字体加载完毕后再 fit —— document.fonts.ready 比 rAF 更可靠
    const doFit = () => {
      if (disposed) return;
      try {
        fitAddon.fit();
        window.electronAPI.terminal.resize(sessionRef.current, terminal.cols, terminal.rows);
      } catch { /* ignore */ }
    };

    // 方案1: document.fonts.ready（最可靠）
    if (document.fonts?.ready) {
      document.fonts.ready.then(() => {
        requestAnimationFrame(() => doFit());
      });
    }
    // 方案2: 兜底 —— 300ms 后再试一次
    const fallbackTimer = setTimeout(() => doFit(), 300);

    // ── 键盘输入 ──
    terminal.onData((data) => {
      window.electronAPI.terminal.write(sessionRef.current, data);
    });

    // ── 选中文本追踪 ──
    terminal.onSelectionChange(() => {
      // 只需触发状态更新，选中状态通过 getSelection() 实时获取
    });

    // ── Ctrl+C/V 复制粘贴拦截（xterm.js KeyboardEvent 级别）──
    // xterm 5.3.0 中 attachCustomKeyEventHandler 返回值被忽略
    // 必须用 event.preventDefault() + stopPropagation() 阻断 xterm 处理
    terminal.attachCustomKeyEventHandler((event: KeyboardEvent): boolean => {
      if (event.type !== 'keydown') return true;
      if (!event.ctrlKey && !event.metaKey) return true;

      // Ctrl+C：有选中 → 复制到剪贴板 + 阻断事件（阻止 SIGINT）
      //          无选中 → 不干预，让 SIGINT 正常发送
      if (event.key === 'c' || event.key === 'C') {
        const sel = terminal.getSelection();
        if (sel) {
          navigator.clipboard.writeText(sel).catch(() => {});
          terminal.clearSelection();
          event.preventDefault();
          event.stopPropagation();
          return false;
        }
        return true;
      }

      // Ctrl+V：自定义读剪贴板写入 PTY + 阻断事件防止双重粘贴
      if (event.key === 'v' || event.key === 'V') {
        event.preventDefault();
        event.stopPropagation();
        navigator.clipboard.readText().then((text) => {
          if (!disposed && text) {
            window.electronAPI.terminal.write(sessionRef.current, text);
          }
        }).catch(() => {});
        return false;
      }

      return true;
    });

    // ── 接收 PTY 输出 ──
    const unsubscribe = window.electronAPI.terminal.onData((sid, data) => {
      if (sid === sessionRef.current && !disposed) {
        terminal.write(data);
      }
    });

    // ── ResizeObserver 自适应（rAF + 防抖，避免最大化动画期间疯狂 resize）──
    let fitTimer: number | null = null;
    const observer = new ResizeObserver(() => {
      if (disposed) return;
      if (fitTimer !== null) cancelAnimationFrame(fitTimer);
      fitTimer = requestAnimationFrame(() => {
        fitTimer = null;
        if (disposed) return;
        try {
          fitAddon.fit();
          if (terminal.cols > 0 && terminal.rows > 0) {
            window.electronAPI.terminal.resize(sessionRef.current, terminal.cols, terminal.rows);
          }
        } catch { /* ignore */ }
      });
    });
    observer.observe(containerRef.current);

    // ── 强制聚焦：多种事件捕获，确保任何交互都能恢复终端焦点 ──
    const focusTerminal = () => {
      if (!disposed && terminalRef.current) {
        terminalRef.current.focus();
      }
    };
    const container = containerRef.current;
    // pointerdown capture — 最常用（点击终端任意位置）
    container.addEventListener('pointerdown', focusTerminal, true);
    // mousedown capture — 某些场景 pointerdown 不可靠时兜底
    container.addEventListener('mousedown', focusTerminal, true);
    // touchstart capture — 触摸屏兜底
    container.addEventListener('touchstart', focusTerminal, true);

    // ── 暴露 focus 方法给父组件 ──
    if (!disposed) {
      terminal.focus();
    }

    // ── 注册 focus 到 store，供 PanelResizer/面板切换后恢复焦点 ──
    // 不在 cleanup 中 nullify，避免新旧 XTerm 切换时的竞态：
    // 新 XTerm 先注册 → 旧 XTerm cleanup nullify 覆盖了新注册
    useTerminalStore.getState().setFocusFn(() => {
      if (!disposed && terminalRef.current) {
        terminalRef.current.focus();
      }
    });

    onReady?.();

    // ── 订阅主题变化，实时更新终端配色 ──
    const unsubTheme = useThemeStore.subscribe((state) => {
      if (!disposed && terminalRef.current) {
        const colors = state.getCurrentColors();
        terminalRef.current.options.theme = getTerminalTheme(colors);
      }
    });

    return () => {
      disposed = true;
      clearTimeout(fallbackTimer);
      container.removeEventListener('pointerdown', focusTerminal, true);
      container.removeEventListener('mousedown', focusTerminal, true);
      container.removeEventListener('touchstart', focusTerminal, true);
      unsubscribe();
      unsubTheme();
      observer.disconnect();
      terminal.dispose();
    };
  }, [sessionId]);

  useImperativeHandle(ref, () => ({
    focus: () => {
      if (terminalRef.current) {
        terminalRef.current.focus();
      }
    },
    hasSelection: () => {
      return !!terminalRef.current?.getSelection();
    },
    copySelection: () => {
      const sel = terminalRef.current?.getSelection();
      if (sel) {
        navigator.clipboard.writeText(sel).catch(() => {});
      }
    },
    pasteClipboard: () => {
      navigator.clipboard.readText().then((text) => {
        if (text) {
          window.electronAPI.terminal.write(sessionRef.current, text);
        }
      }).catch(() => {});
    },
  }), []);

  return (
    <div
      ref={containerRef}
      className="flex-1 min-h-0"
      style={{ outline: 'none' }}
    />
  );
});
