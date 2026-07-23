import { useCallback, useRef, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useLayoutStore } from '../../stores/useLayoutStore';
import { useTerminalStore } from '../../stores/useTerminalStore';

export type PanelId = 'terminal' | 'editor' | 'fileBrowser' | 'everythingSearch' | 'contentSearch' | 'conversations' | 'skills' | 'mcpConfig' | 'browser' | 'prompts';

interface Props {
  panelId: PanelId;
  children: ReactNode;
  className?: string;
}

// 全局拖拽状态 — 用模块级变量避免 React re-render 开销
let dragActive = false;
let dragSourceId: PanelId | null = null;
let dragOverTargetId: PanelId | null = null;
let dragCleanup: (() => void) | null = null;

export function getDragSource(): PanelId | null {
  return dragSourceId;
}

export function getDragOverTarget(): PanelId | null {
  return dragOverTargetId;
}

export function isDragActive(): boolean {
  return dragActive;
}

export function DraggablePanelHeader({ panelId, children, className = '' }: Props) {
  const longPressTimer = useRef<number | null>(null);
  const startPos = useRef({ x: 0, y: 0 });
  const hasMoved = useRef(false);

  const clearDragState = useCallback(() => {
    dragActive = false;
    dragSourceId = null;
    dragOverTargetId = null;
    if (dragCleanup) {
      dragCleanup();
      dragCleanup = null;
    }
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Only allow dragging from the header area, not buttons
    const target = e.target as HTMLElement;
    if (target.closest('button, [data-no-drag]')) return;

    startPos.current = { x: e.clientX, y: e.clientY };
    hasMoved.current = false;

    // 200ms long press to activate drag (faster response)
    longPressTimer.current = window.setTimeout(() => {
      if (!hasMoved.current) {
        dragActive = true;
        dragSourceId = panelId;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);

        // Force a re-render by triggering any store change
        const s = useLayoutStore.getState();
        useLayoutStore.setState({ panelOrder: [...s.panelOrder] });

        dragCleanup = () => {
          if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
          }
        };
      }
    }, 200);
  }, [panelId]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!longPressTimer.current) return;

    const dx = Math.abs(e.clientX - startPos.current.x);
    const dy = Math.abs(e.clientY - startPos.current.y);

    if (dx > 5 || dy > 5) {
      hasMoved.current = true;
      // Cancel long press if moving (likely resizing, not drag-to-reorder)
      if (!dragActive) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }

    if (dragActive && dragSourceId === panelId) {
      // Check which panel we're hovering over
      const elements = document.querySelectorAll('[data-panel-id]');
      let foundTarget: PanelId | null = null;
      elements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (
          e.clientX >= rect.left && e.clientX <= rect.right &&
          e.clientY >= rect.top && e.clientY <= rect.bottom
        ) {
          const id = el.getAttribute('data-panel-id') as PanelId;
          if (id && id !== dragSourceId) {
            foundTarget = id;
          }
        }
      });
      if (foundTarget !== dragOverTargetId) {
        dragOverTargetId = foundTarget;
        // Trigger re-render
        const s = useLayoutStore.getState();
        useLayoutStore.setState({ panelOrder: [...s.panelOrder] });
      }
    }
  }, [panelId]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (dragActive && dragSourceId === panelId) {
      const targetId = dragOverTargetId;
      // Clear drag state FIRST so re-render shows no rings
      clearDragState();
      try {
        (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch { /* ignore */ }
      // Then swap (re-render happens with clean drag state)
      if (targetId && targetId !== panelId) {
        useLayoutStore.getState().swapPanels(panelId, targetId);
      }
      useLayoutStore.setState({ panelOrder: [...useLayoutStore.getState().panelOrder] });
      // 拖拽排序结束后恢复终端焦点
      setTimeout(() => useTerminalStore.getState().focusActiveTerminal?.(), 80);
    }

    hasMoved.current = false;
  }, [panelId, clearDragState]);

  const isDragging = dragActive && dragSourceId === panelId;
  const isDropTarget = dragActive && dragOverTargetId === panelId && dragSourceId !== panelId;

  return (
    <motion.div
      data-panel-id={panelId}
      className={`select-none ${className} ${
        isDragging
          ? 'z-50 cursor-grabbing'
          : ''
      }`}
      layout
      transition={{ type: 'spring', stiffness: 350, damping: 35, mass: 0.5 }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{
        cursor: isDragging ? 'grabbing' : undefined,
        opacity: isDragging ? 0.9 : 1,
        transition: 'opacity 0.18s cubic-bezier(0.25, 0.1, 0.25, 1)',
      }}
    >
      {children}
    </motion.div>
  );
}
