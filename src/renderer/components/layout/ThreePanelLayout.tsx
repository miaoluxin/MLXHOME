import { useCallback } from 'react';
import { motion } from 'framer-motion';
import { PanelResizer } from './PanelResizer';
import { TerminalPanel } from '../terminal/TerminalPanel';
import { EditorPanel } from '../editor/EditorPanel';
import { FileBrowser } from '../filesystem/FileBrowser';
import { useLayoutStore } from '../../stores/useLayoutStore';

export function ThreePanelLayout() {
  const { leftWidth, centerWidth, rightWidth, setLeftWidth, setCenterWidth, setRightWidth } = useLayoutStore();

  const handleResizeLeft = useCallback((delta: number) => {
    setLeftWidth(leftWidth + delta);
    // 中间面板吸收剩余变化（简化处理）
  }, [leftWidth]);

  const handleResizeRight = useCallback((delta: number) => {
    setRightWidth(rightWidth - delta);
    setCenterWidth(centerWidth + delta);
  }, [centerWidth, rightWidth]);

  return (
    <div className="flex h-full w-full p-2 gap-0">
      <motion.div
        layout
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        style={{ width: leftWidth, minWidth: 200 }}
        className="h-full flex-shrink-0"
      >
        <TerminalPanel />
      </motion.div>

      <PanelResizer onResize={handleResizeLeft} />

      <motion.div
        layout
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        style={{ width: centerWidth, minWidth: 300 }}
        className="h-full flex-shrink-0"
      >
        <EditorPanel />
      </motion.div>

      <PanelResizer onResize={handleResizeRight} />

      <motion.div
        layout
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        style={{ flex: 1, minWidth: 200 }}
        className="h-full"
      >
        <FileBrowser />
      </motion.div>
    </div>
  );
}
