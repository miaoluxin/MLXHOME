import { VscStarFull, VscClose } from 'react-icons/vsc';
import { useFavoritesStore } from '../../stores/useFavoritesStore';
import { useFileStore } from '../../stores/useFileStore';

export function FavoritesBar() {
  const { favorites, removeFavorite } = useFavoritesStore();
  const setCurrentPath = useFileStore((s) => s.setCurrentPath);

  if (favorites.length === 0) return null;

  return (
    <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border-subtle overflow-x-auto flex-shrink-0">
      <VscStarFull size={12} className="text-yellow-400 flex-shrink-0 ml-1 mr-0.5" />
      {favorites.map((fav) => (
        <div
          key={fav.path}
          className="group flex items-center gap-1 px-2 py-0.5 rounded-md
                     bg-bg-raised border border-border-subtle
                     hover:border-accent/50 hover:bg-bg-hover
                     transition-colors cursor-pointer flex-shrink-0"
          onClick={() => setCurrentPath(fav.path)}
          title={fav.path}
        >
          <span className="text-xs text-text-secondary group-hover:text-text-primary truncate max-w-[160px]">
            {fav.name}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeFavorite(fav.path);
            }}
            className="p-0 opacity-0 group-hover:opacity-100 text-text-tertiary
                       hover:text-red-400 transition-all rounded-sm hover:bg-bg-deep"
            title="移除收藏"
          >
            <VscClose size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
