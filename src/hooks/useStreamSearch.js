import { useCallback, useState } from 'react';
import { getGameByName, fetchStreams, fetchLiveStreamsByUserIds, fetchUserProfiles, filterStreams, sortStreams, dedupeStreams } from '../api/twitch.js';
import { MOCK_STREAMS } from '../mock/mockStreams.js';

// 空欄・0・不正値は「打ち切らない」の意味にする
function toPositiveInt(value) {
  const n = parseInt((value ?? '').toString().trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// カテゴリ（ゲーム）の解決。
// settings.gameId が埋まるのはサジェストから選んだときだけで、名前を手で打つと
// SearchFilters が gameId を空にクリアする。つまり「ゲーム名は入っているが ID は空」が
// 通常の状態なので、その場合は名前から引き直す。
// ここを省いて gameId の有無だけで分岐すると、呼び出し側が黙って
// 「カテゴリ指定なし」に化ける（覚えているチャンネルの確認で他カテゴリの人まで出た原因）。
//   none     … カテゴリ指定なし（ゲーム名が空）
//   found    … 解決できた
//   notFound … 名前は指定されたが Twitch 側に見つからない
async function resolveGame(token, settings) {
  const name = (settings.gameName || '').trim();
  if (settings.gameId) {
    return { kind: 'found', game: { id: String(settings.gameId), name, box_art_url: settings.gameBoxArtUrl } };
  }
  if (!name) return { kind: 'none' };
  const game = await getGameByName(token, name);
  return game ? { kind: 'found', game } : { kind: 'notFound', name };
}

// 検索の実行ロジック（本体の検索画面と DPGK ページで共有）。
// streams / gameInfo / status / searching を管理し、デモ・実データ両対応。
export function useStreamSearch(initialStreams = []) {
  const [streams, setStreams] = useState(initialStreams);
  const [gameInfo, setGameInfo] = useState(null);
  const [status, setStatus] = useState('');
  const [searching, setSearching] = useState(false);

  const searchDemo = useCallback((settings) => {
    const filtered = sortStreams(dedupeStreams(filterStreams(MOCK_STREAMS, settings)), settings.sortOrder);
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
      const resolved = await resolveGame(token, settings);
      if (resolved.kind !== 'found') {
        setGameInfo({ notFound: gameName });
        setStatus('指定されたゲーム名が見つからなかったため、配信を検索できません。');
        return;
      }
      const game = resolved.game;
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
      // ページ境界で同じ配信が二度返ることがあるため、配列ではなく user_id をキーにした
      // Map に積む。ここで畳んでおかないと打ち切り判定（targetMatches）も水増しされる。
      const matches = new Map();
      const remember = (list) => {
        list.forEach((s) => {
          const key = s.user_id != null ? `id:${s.user_id}` : `login:${(s.user_login || '').toLowerCase()}`;
          if (key === 'login:') return;
          matches.set(key, s); // 新しく届いた方（視聴者数などが最新）で上書き
        });
      };
      setStatus(`ゲームID「${game.id}」で配信を検索中...`);
      const { fetched, capped, stoppedEarly } = await fetchStreams(token, query, {
        onPage: (page, total) => {
          remember(filterStreams(page.filter(matchesQuery), settings));
          setStatus(`検索中... ${total}件を確認、${matches.size}件が条件に一致`);
          setStreams(sortStreams([...matches.values()], settings.sortOrder));
          return !(canStopEarly && targetMatches && matches.size >= targetMatches);
        },
      });

      if (stoppedEarly) {
        note = ` 一致が${targetMatches}件に達したため、${fetched}件を調べた時点で打ち切りました。視聴者数の多い順に調べているため、上位の配信は含まれています。`;
      } else if (capped) {
        note = ' 取得上限（1000件）に達したため、これ以上のページ取得を打ち切りました。視聴者数の多い順に取得しているため、人気配信は含まれています。';
      }

      let filtered = sortStreams([...matches.values()], settings.sortOrder);
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

  // 覚えているチャンネルだけを対象に、いま配信中かを確認する。
  // カテゴリを頭からページングし直すのではなく user_id で直接引くので、
  // 覚えている数が1000でも10リクエスト（並列なので実質1往復）で終わる。
  // ただし前回以降に現れた新しい配信者は当然拾えない。全体検索の代わりにはならない。
  const refreshKnown = useCallback(async (token, settings, knownChannels = []) => {
    if (!token) {
      setStatus('エラー: Twitch認証が完了していません。');
      return;
    }
    const ids = knownChannels.map((c) => c.user_id).filter(Boolean);
    if (ids.length === 0) {
      setStatus('まだ覚えているチャンネルがありません。先に通常の検索を実行してください。');
      return;
    }

    setSearching(true);
    setStatus(`覚えている${ids.length}チャンネルの配信状況を確認中...`);
    try {
      // 覚えているのは「過去のどれかの検索で見つかった人」全員なので、カテゴリを跨いでいる。
      // 絞り込みは取得後にこちらでかける（user_id と game_id を同時にクエリへ載せると
      // 結合規則に依存するため）。ID が手元に無ければ名前から引き直す。
      // 解決できないまま素通しすると、他カテゴリで覚えた人まで結果に出てしまう。
      const resolved = await resolveGame(token, settings);
      if (resolved.kind === 'notFound') {
        setStatus(`「${settings.gameName.trim()}」というカテゴリが見つからないため、絞り込めません。ゲーム名を確認してください。`);
        return;
      }
      const gameId = resolved.kind === 'found' ? String(resolved.game.id) : '';

      const { live, offline, unknown, checked } = await fetchLiveStreamsByUserIds(token, ids);
      const scoped = gameId ? live.filter((s) => String(s.game_id) === gameId) : live;

      let filtered = sortStreams(dedupeStreams(filterStreams(scoped, settings)), settings.sortOrder);
      setStreams(filtered);

      if (filtered.length > 0) {
        setStatus(`${checked}件中 ${live.length}件が配信中、条件に一致は${filtered.length}件。アイコンを取得中...`);
        const userIds = [...new Set(filtered.map((s) => s.user_id))];
        const profiles = await fetchUserProfiles(token, userIds);
        filtered = filtered.map((s) => ({ ...s, profile_image_url: profiles[s.user_id] }));
        setStreams(filtered);
      }
      const unknownNote = unknown.length > 0
        ? ` ${unknown.length}件は取得に失敗したため状態不明です。`
        : '';
      const scopeNote = gameId
        ? `そのうち「${resolved.game.name}」は${scoped.length}件。`
        : 'カテゴリの指定が無いため全カテゴリが対象です。';
      setStatus(
        `${checked}件を確認: ${live.length}件が配信中 / ${offline.length}件がオフライン。` +
        `${scopeNote}条件に一致したのは${filtered.length}件です。${unknownNote}`
      );
    } catch (err) {
      console.error('配信状況の確認エラー:', err);
      setStatus(`エラーが発生しました: ${err.message}`);
    } finally {
      setSearching(false);
    }
  }, []);

  return { streams, setStreams, gameInfo, setGameInfo, status, setStatus, searching, searchDemo, searchReal, refreshKnown };
}
