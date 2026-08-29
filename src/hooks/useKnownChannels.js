import { useCallback, useState } from 'react';

const KEY = 'twitchKnownChannels';
const MAX = 1000;
const TTL_DAYS = 30;

// 検索で一度でも引っかかったチャンネルを覚えておく。
// ここに貯めるのは識別子だけ。タイトルや視聴者数はライブ確認のたびに
// Twitch から新しいものが返ってくるので、保存しても古くなるだけで意味がない。
//
// login は本人がいつでも変更できるが user_id は不変なので、照会キーは user_id を使う。
// login / name は表示用の控え。

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(raw) ? raw.filter((c) => c && c.user_id) : [];
  } catch {
    return [];
  }
}

function save(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
  return list;
}

// 古いものと溢れた分を落とす。last_seen の新しい順に並べて上から MAX 件。
function prune(list, now) {
  const cutoff = now - TTL_DAYS * 24 * 60 * 60 * 1000;
  const alive = list.filter((c) => (c.last_seen ?? 0) >= cutoff);
  alive.sort((a, b) => (b.last_seen ?? 0) - (a.last_seen ?? 0));
  return alive.length > MAX ? alive.slice(0, MAX) : alive;
}

export function useKnownChannels() {
  const [known, setKnown] = useState(() => prune(load(), Date.now()));

  // 検索結果に出てきたチャンネルを覚える（user_id で突き合わせて last_seen を更新）
  const remember = useCallback((streams) => {
    if (!Array.isArray(streams) || streams.length === 0) return;
    const now = Date.now();
    setKnown((prev) => {
      const byId = new Map(prev.map((c) => [String(c.user_id), c]));
      let changed = false;
      streams.forEach((s) => {
        if (!s || !s.user_id) return;
        const id = String(s.user_id);
        const before = byId.get(id);
        const next = {
          user_id: id,
          user_login: s.user_login || before?.user_login || '',
          user_name: s.user_name || before?.user_name || '',
          last_seen: now,
        };
        if (!before || before.user_login !== next.user_login || before.user_name !== next.user_name) {
          changed = true;
        }
        byId.set(id, next);
      });
      if (!changed && byId.size === prev.length) {
        // 顔ぶれも表示名も変わっていないなら last_seen だけの更新。書き込みは1回で済ませる
        const touched = prune([...byId.values()], now);
        save(touched);
        return touched;
      }
      return save(prune([...byId.values()], now));
    });
  }, []);

  const forget = useCallback((userId) => {
    setKnown((prev) => save(prev.filter((c) => String(c.user_id) !== String(userId))));
  }, []);

  const clearKnown = useCallback(() => {
    localStorage.removeItem(KEY);
    setKnown([]);
  }, []);

  return { known, remember, forget, clearKnown };
}
