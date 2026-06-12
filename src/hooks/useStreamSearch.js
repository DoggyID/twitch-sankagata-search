import { useCallback, useState } from 'react';
import { getGameByName, fetchAllStreams, fetchUserProfiles, filterStreams, sortStreams } from '../api/twitch.js';
import { MOCK_STREAMS } from '../mock/mockStreams.js';

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

  const searchReal = useCallback(async (token, settings) => {
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
    try {
      setGameInfo({ loading: `「${gameName}」のIDを検索中...` });
      const game = await getGameByName(token, gameName);
      if (!game) {
        setGameInfo({ notFound: gameName });
        setStatus('指定されたゲーム名が見つからなかったため、配信を検索できません。');
        return;
      }
      setGameInfo({ ...game });

      setStatus(`ゲームID「${game.id}」で配信を検索中...`);
      const all = await fetchAllStreams(token, game.id, settings.language, (count) => {
        setStatus(`配信を検索中... (現在${count}件取得済み)`);
      });

      let filtered = sortStreams(filterStreams(all, settings), settings.sortOrder);

      if (filtered.length > 0) {
        setStatus(`${filtered.length}件の配信が見つかりました。配信者のアイコンを取得中...`);
        const userIds = [...new Set(filtered.map((s) => s.user_id))];
        const profiles = await fetchUserProfiles(token, userIds);
        filtered = filtered.map((s) => ({ ...s, profile_image_url: profiles[s.user_id] }));
        setStatus(`${filtered.length}件の配信が見つかりました。`);
      } else {
        setStatus('0件の配信が見つかりました。指定された条件に一致するライブ配信は見つかりませんでした。');
      }
      setStreams(filtered);
    } catch (err) {
      console.error('検索エラー:', err);
      setStatus(`エラーが発生しました: ${err.message}`);
    } finally {
      setSearching(false);
    }
  }, []);

  return { streams, setStreams, gameInfo, setGameInfo, status, setStatus, searching, searchDemo, searchReal };
}
