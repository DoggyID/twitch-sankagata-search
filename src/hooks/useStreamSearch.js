import { useCallback, useState } from 'react';
import { getGameByName, fetchStreams, fetchUserProfiles, filterStreams, sortStreams } from '../api/twitch.js';
import { MOCK_STREAMS } from '../mock/mockStreams.js';

// 空欄・0・不正値は「打ち切らない」の意味にする
function toPositiveInt(value) {
  const n = parseInt((value ?? '').toString().trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// 検索の実行ロジック（本体の検索画面と DPGK ページで共有）。
// streams / gameInfo / status / searching を管理し、デモ・実データ両対応。
export function useStreamSearch(initialStreams = []) {
  const [streams, setStreams] = useState(initialStreams);
  const [gameInfo, setGameInfo] = useState(null);
  const [status, setStatus] = useState('');
  const [searching, setSearching] = useState(false);

  const searchDemo = useCallback((settings) => {
    const filtered = sortStreams(filterStreams(MOCK_STREAMS, settings), settings.sortOrder);
    setStreams(filtered);
    setGameInfo({ name: settings.gameName || 'デモ', id: 'demo' });
    setStatus(`${filtered.length}件の配信が見つかりました。（デモモード）`);
    return filtered;
  }, []);

  const searchReal = useCallback(async (token, settings, options = {}) => {
    if (!token) {
      setStatus('エラー: Twitch認証が完了していません。');
      return;
    }
    const gameName = settings.gameName.trim();
    if (!gameName) {
      setGameInfo({ error: '検索するゲーム名を入力してください。' });
      return;
    }
    setSearching(true);
    setStatus('');
    let note = '';
    try {
      setGameInfo({ loading: `「${gameName}」のIDを検索中...` });
      const game = settings.gameId
        ? { id: settings.gameId, name: gameName, box_art_url: settings.gameBoxArtUrl }
        : await getGameByName(token, gameName);
      if (!game) {
        setGameInfo({ notFound: gameName });
        setStatus('指定されたゲーム名が見つからなかったため、配信を検索できません。');
        return;
      }
      setGameInfo({ ...game });

      // Twitch は viewer_count 降順で返す。
      // 「多い順」なら欲しいものが先頭から並ぶので、必要数が集まった時点で止めてよい。
      // 「少ない順」は答えが最後のページにあるため、途中で止めると結果が変わってしまう。
      const canStopEarly = (settings.sortOrder || 'desc') !== 'asc';
      const targetMatches = toPositiveInt(settings.targetMatches);

      // API 側で絞れる分はすべてクエリに載せる（完全一致のみ・あいまい検索は挟まらない）。
      const favorites = options.favorites || [];
      const useFavorites = !!settings.onlyFavorites && favorites.length > 0;
      const query = {
        gameIds: [game.id],
        languages: settings.languages,
        userLogins: useFavorites ? favorites : [],
        type: 'live',
      };

      // user_login と game_id を同時に渡したときの結合規則を実APIで確認できていないため、
      // 取りこぼしではなく取りすぎ側に倒れても平気なようにゲーム一致をこちらでも確認する。
      const matchesQuery = (s) => !useFavorites || !game.id || String(s.game_id) === String(game.id);

      // 1ページ取るたびに絞り込む。全件そろうのを待たずに一致分を積み上げていく。
      const matches = [];
      setStatus(`ゲームID「${game.id}」で配信を検索中...`);
      const { fetched, capped, stoppedEarly } = await fetchStreams(token, query, {
        onPage: (page, total) => {
          matches.push(...filterStreams(page.filter(matchesQuery), settings));
          setStatus(`検索中... ${total}件を確認、${matches.length}件が条件に一致`);
          setStreams(sortStreams(matches, settings.sortOrder));
          return !(canStopEarly && targetMatches && matches.length >= targetMatches);
        },
      });

      if (stoppedEarly) {
        note = ` 一致が${targetMatches}件に達したため、${fetched}件を調べた時点で打ち切りました。視聴者数の多い順に調べているため、上位の配信は含まれています。`;
      } else if (capped) {
        note = ' 取得上限（1000件）に達したため、これ以上のページ取得を打ち切りました。視聴者数の多い順に取得しているため、人気配信は含まれています。';
      }

      let filtered = sortStreams(matches, settings.sortOrder);
      setStreams(filtered);

      if (filtered.length > 0) {
        setStatus(`${filtered.length}件の配信が見つかりました。配信者のアイコンを取得中...`);
        const userIds = [...new Set(filtered.map((s) => s.user_id))];
        const profiles = await fetchUserProfiles(token, userIds);
        filtered = filtered.map((s) => ({ ...s, profile_image_url: profiles[s.user_id] }));
        setStreams(filtered);
        setStatus(`${filtered.length}件の配信が見つかりました。`);
      } else {
        setStatus('0件の配信が見つかりました。指定された条件に一致するライブ配信は見つかりませんでした。');
      }
    } catch (err) {
      console.error('検索エラー:', err);
      setStatus(`エラーが発生しました: ${err.message}`);
    } finally {
      if (note) {
        setStatus((current) => `${current}${note}`);
      }
      setSearching(false);
    }
  }, []);

  return { streams, setStreams, gameInfo, setGameInfo, status, setStatus, searching, searchDemo, searchReal };
}
