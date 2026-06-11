import { useCallback, useState } from 'react';

const FAV_KEY = 'twitchFavoriteChannels';
const EX_KEY = 'twitchExcludedChannels';

export function normalizeLogin(login) {
  return (login || '').trim().toLowerCase();
}

function load(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw).map(normalizeLogin).filter(Boolean);
  } catch (e) { /* ignore */ }
  return [];
}

function save(key, list) {
  localStorage.setItem(key, JSON.stringify(list));
  return list;
}

// お気に入り / 除外チャンネル管理（相互排他）
export function useChannels() {
  const [favorites, setFavorites] = useState(() => load(FAV_KEY));
  const [excluded, setExcluded] = useState(() => load(EX_KEY));

  const isFavorite = useCallback((login) => favorites.includes(normalizeLogin(login)), [favorites]);
  const isExcluded = useCallback((login) => excluded.includes(normalizeLogin(login)), [excluded]);

  const addFavorite = useCallback((login) => {
    const n = normalizeLogin(login);
    if (!n) return;
    setExcluded((ex) => (ex.includes(n) ? save(EX_KEY, ex.filter((x) => x !== n)) : ex));
    setFavorites((fav) => (fav.includes(n) ? fav : save(FAV_KEY, [...fav, n])));
  }, []);

  const removeFavorite = useCallback((login) => {
    const n = normalizeLogin(login);
    setFavorites((fav) => (fav.includes(n) ? save(FAV_KEY, fav.filter((x) => x !== n)) : fav));
  }, []);

  const addExcluded = useCallback((login) => {
    const n = normalizeLogin(login);
    if (!n) return;
    setFavorites((fav) => (fav.includes(n) ? save(FAV_KEY, fav.filter((x) => x !== n)) : fav));
    setExcluded((ex) => (ex.includes(n) ? ex : save(EX_KEY, [...ex, n])));
  }, []);

  const removeExcluded = useCallback((login) => {
    const n = normalizeLogin(login);
    setExcluded((ex) => (ex.includes(n) ? save(EX_KEY, ex.filter((x) => x !== n)) : ex));
  }, []);

  const toggleFavorite = useCallback((login) => {
    if (favorites.includes(normalizeLogin(login))) removeFavorite(login);
    else addFavorite(login);
  }, [favorites, addFavorite, removeFavorite]);

  return {
    favorites, excluded,
    isFavorite, isExcluded,
    addFavorite, removeFavorite, addExcluded, removeExcluded, toggleFavorite,
  };
}
