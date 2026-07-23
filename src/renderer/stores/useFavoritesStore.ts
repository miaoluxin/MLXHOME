import { create } from 'zustand';

export interface Favorite {
  name: string;
  path: string;
}

const STORAGE_KEY = 'mlx-favorites';

function loadFavorites(): Favorite[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    // 兼容旧格式: 旧版只存 string[]
    if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'string') {
      return data.map((p: string) => ({ name: p.split(/[/\\]/).pop() || p, path: p }));
    }
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveFavorites(favorites: Favorite[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
}

interface FavoritesState {
  favorites: Favorite[];
  isFavorited: (path: string) => boolean;
  addFavorite: (name: string, path: string) => void;
  removeFavorite: (path: string) => void;
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  favorites: loadFavorites(),

  isFavorited: (path: string) => {
    return get().favorites.some((f) => f.path === path);
  },

  addFavorite: (name: string, path: string) => {
    const existing = get().favorites.find((f) => f.path === path);
    if (existing) return;
    const next = [...get().favorites, { name, path }];
    saveFavorites(next);
    set({ favorites: next });
  },

  removeFavorite: (path: string) => {
    const next = get().favorites.filter((f) => f.path !== path);
    saveFavorites(next);
    set({ favorites: next });
  },
}));
