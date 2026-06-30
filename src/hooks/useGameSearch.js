import { useEffect, useRef, useState } from 'react';
import { CLIENT_ID } from '../config.js';

const HELIX = 'https://api.twitch.tv/helix';
const DEBOUNCE_MS = 350;

// ゲーム名の部分一致候補を検索（GET /helix/search/categories）。
// token が無い場合（デモモード等）は何もしない。
export function useGameSearch(token) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);
  const reqIdRef = useRef(0);

  useEffect(() => {
    window.clearTimeout(timerRef.current);
    if (!token || !query.trim()) {
      reqIdRef.current += 1;
      setSuggestions([]);
      setLoading(false);
      return;
    }

    timerRef.current = window.setTimeout(async () => {
      const myReqId = ++reqIdRef.current;
      setLoading(true);

      try {
        const res = await fetch(
          `${HELIX}/search/categories?query=${encodeURIComponent(query.trim())}&first=20`,
          { headers: { Authorization: `Bearer ${token}`, 'Client-ID': CLIENT_ID } }
        );
        const data = await res.json();
        if (myReqId !== reqIdRef.current) return;
        setSuggestions(res.ok && data.data ? data.data : []);
      } catch {
        if (myReqId === reqIdRef.current) setSuggestions([]);
      } finally {
        if (myReqId === reqIdRef.current) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timerRef.current);
  }, [query, token]);

  return { query, setQuery, suggestions, loading };
}
