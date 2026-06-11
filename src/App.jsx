import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Header from './components/Header.jsx';
import AuthSection from './components/AuthSection.jsx';
import SearchFilters from './components/SearchFilters.jsx';
import ChannelManagement from './components/ChannelManagement.jsx';
import Results from './components/Results.jsx';
import PreviewPanel from './components/PreviewPanel.jsx';
import ZapMode from './components/ZapMode/ZapMode.jsx';
import { useTheme } from './hooks/useTheme.js';
import { useAuth } from './hooks/useAuth.js';
import { useChannels, normalizeLogin } from './hooks/useChannels.js';
import { useVisited } from './hooks/useVisited.js';
import { useSettings } from './hooks/useSettings.js';
import { getGameByName, fetchAllStreams, fetchUserProfiles, filterStreams, sortStreams } from './api/twitch.js';
import { MOCK_STREAMS } from './mock/mockStreams.js';
import { activateChaos } from './chaos.js';

const DEMO_PARAM = new URLSearchParams(window.location.search).get('demo') === '1';

export default function App() {
  const [isDark, setIsDark] = useTheme();
  const { token, authError, authUrl } = useAuth();
  const channels = useChannels();
  const visited = useVisited();
  const [settings, updateSettings] = useSettings();

  const [demoMode, setDemoMode] = useState(DEMO_PARAM);
  const [streams, setStreams] = useState(DEMO_PARAM ? sortStreams(MOCK_STREAMS, 'desc') : []);
  const [gameInfo, setGameInfo] = useState(null);
  const [status, setStatus] = useState('');
  const [searching, setSearching] = useState(false);
  const [preview, setPreview] = useState(null);
  const [zapOpen, setZapOpen] = useState(false);

  const authed = !!token || demoMode;

  // 並び替え順を変更したら、その場で表示中の配信を並べ直す（検索を待たない）
  const firstSortRun = useRef(true);
  useEffect(() => {
    if (firstSortRun.current) {
      firstSortRun.current = false;
      return;
    }
    setStreams((prev) => (prev.length > 0 ? sortStreams(prev, settings.sortOrder) : prev));
  }, [settings.sortOrder]);

  // 表示名キャッシュ（チャンネル管理の表示用）
  const nameCache = useMemo(() => {
    const cache = {};
    streams.forEach((s) => {
      const n = normalizeLogin(s.user_login);
      if (n) cache[n] = s.user_name;
    });
    return cache;
  }, [streams]);

  // お気に入り / その他 / 既視聴フィルタ（本体 renderResults と同等）
  const { favList, othersVisible } = useMemo(() => {
    const fav = [];
    const others = [];
    streams.forEach((s) => {
      const login = normalizeLogin(s.user_login);
      if (channels.isExcluded(login)) return;
      if (channels.isFavorite(login)) fav.push(s);
      else others.push(s);
    });
    const othersVis = others.filter((s) => !visited.isVisited(s.user_login));
    return { favList: fav, othersVisible: othersVis };
  }, [streams, channels, visited]);

  // --- 検索 ---
  const runDemoSearch = useCallback(() => {
    const filtered = sortStreams(filterStreams(MOCK_STREAMS, settings), settings.sortOrder);
    setStreams(filtered);
    setGameInfo({ name: settings.gameName || 'デモ', id: 'demo' });
    setStatus(`${filtered.length}件の配信が見つかりました。（デモモード）`);
  }, [settings]);

  const handleSearch = useCallback(async () => {
    if (demoMode) {
      runDemoSearch();
      return;
    }
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
  }, [demoMode, runDemoSearch, token, settings]);

  const handleReset = useCallback(() => {
    if (!confirm('既視聴履歴をクリアしますか？\n(検索条件・お気に入り・除外リストは保持されます)')) return;
    visited.clearVisited();
  }, [visited]);

  const handleDemo = useCallback(() => {
    setDemoMode(true);
    const filtered = sortStreams(filterStreams(MOCK_STREAMS, settings), settings.sortOrder);
    setStreams(filtered);
    setGameInfo({ name: settings.gameName || 'デモ', id: 'demo' });
    setStatus(`${filtered.length}件の配信が見つかりました。（デモモード）`);
  }, [settings]);

  // --- プレビュー操作 ---
  const previewToggleFav = useCallback(() => {
    if (!preview) return;
    channels.toggleFavorite(preview.user_login);
  }, [preview, channels]);

  const previewExclude = useCallback(() => {
    if (!preview) return;
    if (!confirm(`「${preview.user_name}」を検索除外に追加しますか？`)) return;
    channels.addExcluded(preview.user_login);
    setPreview(null);
  }, [preview, channels]);

  const previewVisited = useCallback(() => {
    if (!preview) return;
    visited.addVisited(preview);
    setPreview(null);
  }, [preview, visited]);

  return (
    <div className="container">
      <Header isDark={isDark} onToggleTheme={setIsDark} />

      {!authed && <AuthSection authUrl={authUrl} authError={authError} onDemo={handleDemo} />}

      {authed && (
        <div id="searchSection">
          {demoMode && (
            <p className="demo-banner">🎬 デモモード表示中（サンプルデータ・認証なし）</p>
          )}

          <SearchFilters
            settings={settings}
            onChange={updateSettings}
            onSearch={handleSearch}
            onReset={handleReset}
            onChaos={activateChaos}
            onZap={() => setZapOpen(true)}
            searching={searching}
          />

          <ChannelManagement channels={channels} nameCache={nameCache} />

          {gameInfo && <GameInfo info={gameInfo} />}

          <h2>検索結果 (ライブ配信):</h2>
          {status && <div id="searchStatus"><p className="result-count">{status}</p></div>}

          <div className="results-with-preview">
            <Results
              favList={favList}
              othersList={othersVisible}
              visited={visited.visited}
              isVisited={visited.isVisited}
              previewLogin={preview?.user_login}
              onSelect={setPreview}
            />
            <PreviewPanel
              stream={preview}
              isFavorite={preview ? channels.isFavorite(preview.user_login) : false}
              onToggleFavorite={previewToggleFav}
              onExclude={previewExclude}
              onVisited={previewVisited}
              onClose={() => setPreview(null)}
            />
          </div>
        </div>
      )}

      {zapOpen && (
        <ZapMode
          favList={favList}
          othersList={othersVisible}
          channels={channels}
          visited={visited}
          onClose={() => setZapOpen(false)}
        />
      )}
    </div>
  );
}

function GameInfo({ info }) {
  if (info.error) return <div id="gameIdQueryResult"><p className="error">{info.error}</p></div>;
  if (info.loading) return <div id="gameIdQueryResult"><p>{info.loading}</p></div>;
  if (info.notFound) return <div id="gameIdQueryResult"><p>「{info.notFound}」という名前のゲームは見つかりませんでした。</p></div>;
  if (info.id === 'demo') {
    return <div id="gameIdQueryResult"><p><strong>「{info.name}」</strong>（デモモード）</p></div>;
  }
  return (
    <div id="gameIdQueryResult">
      <p><strong>「{info.name}」</strong> (ID: <strong>{info.id}</strong>) が見つかりました。</p>
      {info.box_art_url && (
        <p><img src={info.box_art_url.replace('{width}x{height}', '52x72')} alt={`${info.name} のボックスアート`} /></p>
      )}
    </div>
  );
}
