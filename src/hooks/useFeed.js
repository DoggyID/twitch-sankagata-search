import { useMemo } from 'react';
import { normalizeLogin } from './useChannels.js';
import { dedupeStreams } from '../api/twitch.js';

// streams を お気に入り/その他に振り分ける共通ロジック（検索画面・DPGK両方で使用）。
// 除外は常に除く。既視聴も常に除く（お気に入りでも既視聴なら表示しない）。
//
// 画面に出る直前の最後の関門なので、ここでも一度畳む。取得側でも畳んでいるが、
// 同じ配信者が2枚出ると React の key が衝突し、以降の更新でDOMが壊れて
// 「パネルが件数より多い / 増殖する」状態になるため、二重に防ぐ価値がある。
export function useFeed(streams, channels, visited) {
  return useMemo(() => {
    const favList = [];
    const othersList = [];
    dedupeStreams(streams).forEach((s) => {
      const login = normalizeLogin(s.user_login);
      if (channels.isExcluded(login)) return;
      if (visited.isVisited(s.user_login)) return;
      if (channels.isFavorite(login)) favList.push(s);
      else othersList.push(s);
    });
    return { favList, othersList, counts: { fav: favList.length, others: othersList.length } };
  }, [streams, channels.favorites, channels.excluded, visited.visited]);
}
