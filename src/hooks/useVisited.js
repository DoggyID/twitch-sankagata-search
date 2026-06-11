import { useCallback, useState } from 'react';

const KEY = 'twitchVisitedStreams';
const MAX = 50;

// 既視聴配信の管理（上限50件、新しい順）
export function useVisited() {
  const [visited, setVisited] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
  });

  const isVisited = useCallback(
    (login) => visited.some((v) => v.user_login === login),
    [visited]
  );

  const addVisited = useCallback((stream) => {
    setVisited((prev) => {
      if (prev.some((s) => s.user_login === stream.user_login)) return prev;
      const next = [
        {
          user_login: stream.user_login,
          user_name: stream.user_name,
          title: stream.title,
          thumbnail_url: stream.thumbnail_url,
          viewed_at: new Date().toISOString(),
        },
        ...prev,
      ];
      if (next.length > MAX) next.length = MAX;
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearVisited = useCallback(() => {
    localStorage.removeItem(KEY);
    setVisited([]);
  }, []);

  return { visited, isVisited, addVisited, clearVisited };
}
