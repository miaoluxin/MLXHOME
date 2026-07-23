import { useState } from 'react';
import { VscStarFull, VscStarEmpty, VscClose } from 'react-icons/vsc';
import { useFavoritesStore } from '../../stores/useFavoritesStore';

interface Props {
  currentPath: string;
}

export function FavoritesButton({ currentPath }: Props) {
  const { favorites, isFavorited, addFavorite, removeFavorite } = useFavoritesStore();
  const [showModal, setShowModal] = useState(false);
  const [favName, setFavName] = useState('');

  const favorited = isFavorited(currentPath);

  const handleClick = () => {
    if (favorited) {
      // 已收藏 → 弹出确认取消
      setShowModal(true);
    } else {
      // 未收藏 → 弹出添加对话框
      const defaultName = currentPath.split(/[/\\]/).pop() || currentPath;
      setFavName(defaultName);
      setShowModal(true);
    }
  };

  const handleConfirmAdd = () => {
    if (favName.trim()) {
      addFavorite(favName.trim(), currentPath);
      setShowModal(false);
      setFavName('');
    }
  };

  const handleConfirmRemove = () => {
    removeFavorite(currentPath);
    setShowModal(false);
  };

  return (
    <>
      <button
        onClick={handleClick}
        className={`p-1 rounded transition-colors ${
          favorited
            ? 'text-yellow-400 hover:text-yellow-300'
            : 'text-text-tertiary hover:text-yellow-400'
        }`}
        title={favorited ? '管理收藏' : '收藏此目录'}
      >
        {favorited ? <VscStarFull size={14} /> : <VscStarEmpty size={14} />}
      </button>

      {/* 收藏管理对话框 */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowModal(false)}
        >
          <div
            className="glass-panel p-4 min-w-[320px] max-w-[450px] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {favorited ? (
              /* 取消收藏确认 */
              <>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-text-primary">取消收藏</span>
                  <button
                    onClick={() => setShowModal(false)}
                    className="p-0.5 rounded hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors"
                  >
                    <VscClose size={16} />
                  </button>
                </div>
                <p className="text-xs text-text-secondary mb-1">
                  确定要取消收藏此目录吗？
                </p>
                <p className="text-xs text-text-tertiary mb-4 truncate font-mono">
                  {currentPath}
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowModal(false)}
                    className="px-3 py-1.5 text-xs rounded-md bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleConfirmRemove}
                    className="px-3 py-1.5 text-xs rounded-md bg-red-600/80 text-white hover:bg-red-600 transition-colors"
                  >
                    确认取消收藏
                  </button>
                </div>
              </>
            ) : (
              /* 添加收藏 */
              <>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-text-primary">添加收藏</span>
                  <button
                    onClick={() => setShowModal(false)}
                    className="p-0.5 rounded hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors"
                  >
                    <VscClose size={16} />
                  </button>
                </div>
                <p className="text-xs text-text-tertiary mb-1 truncate font-mono">
                  {currentPath}
                </p>
                <div className="mb-4">
                  <label className="block text-xs text-text-secondary mb-1">收藏名称</label>
                  <input
                    autoFocus
                    value={favName}
                    onChange={(e) => setFavName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleConfirmAdd();
                      if (e.key === 'Escape') setShowModal(false);
                    }}
                    className="w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-1.5 text-sm
                               text-text-primary outline-none focus:border-accent transition-colors
                               placeholder-text-tertiary"
                    placeholder="输入收藏名称..."
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowModal(false)}
                    className="px-3 py-1.5 text-xs rounded-md bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleConfirmAdd}
                    disabled={!favName.trim()}
                    className="px-3 py-1.5 text-xs rounded-md bg-accent text-white hover:bg-accent-hover
                               transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    确认收藏
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
