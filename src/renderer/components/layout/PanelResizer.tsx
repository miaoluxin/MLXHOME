import { useCallback, useRef } from 'react';
import { motion } from 'framer-motion';

interface Props {
  onResize: (delta: number) => void;
  onDragEnd?: () => void;
  direction?: 'horizontal' | 'vertical';
}

export function PanelResizer({ onResize, onDragEnd, direction = 'horizontal' }: Props) {
  const dragging = useRef(false);
  const startX = useRef(0);
  const isHorizontal = direction === 'horizontal';

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    dragging.current = true;
    startX.current = isHorizontal ? e.clientX : e.clientY;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [isHorizontal]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const currentPos = isHorizontal ? e.clientX : e.clientY;
    const delta = currentPos - startX.current;
    startX.current = currentPos;
    onResize(delta);
  }, [onResize, isHorizontal]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const wasDragging = dragging.current;
    dragging.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    if (wasDragging) {
      onDragEnd?.();
    }
  }, [onDragEnd]);

  return (
    <motion.div
      className={`relative flex-shrink-0 group z-10 ${
        isHorizontal
          ? 'w-[6px] cursor-col-resize'
          : 'h-[6px] cursor-row-resize'
      }`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div className={`absolute bg-border-subtle group-hover:bg-accent transition-colors duration-200 ${
        isHorizontal
          ? 'inset-y-0 left-1/2 -translate-x-1/2 w-[2px]'
          : 'inset-x-0 top-1/2 -translate-y-1/2 h-[2px]'
      }`} />
    </motion.div>
  );
}
