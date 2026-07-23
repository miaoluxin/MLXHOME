import { useCallback } from 'react';
import { motion } from 'framer-motion';
import { PanelResizer } from './PanelResizer';
import { TerminalPanel } from '../terminal/TerminalPanel';
import { FileBrowser } from '../filesystem/FileBrowser';
import { useLayoutStore } from '../../stores/useLayoutStore';

export function TwoPanelLayout() {
  const { leftWidth, rightWidth, setLeftWidth, setRightWidth } = useLayoutStore();

  const handleResize = useCallback((delta: number) => {
    setLeftWidth(leftWidth + delta);
    setRightWidth(rightWidth - delta);
  }, [leftWidth, rightWidth]);

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

      <PanelResizer onResize={handleResize} />

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
