import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Header from './components/Header.jsx';
import AuthSection from './components/AuthSection.jsx';
import SearchFilters from './components/SearchFilters.jsx';
import ChannelManagement from './components/ChannelManagement.jsx';
import Results from './components/Results.jsx';
import PreviewPanel from './components/PreviewPanel.jsx';
import { useTheme } from './hooks/useTheme.js';
import { useAuth } from './hooks/useAuth.js';
import { useChannels, normalizeLogin } from './hooks/useChannels.js';
import { useVisited } from './hooks/useVisited.js';
import { useSettings } from './hooks/useSettings.js';
import { useStreamSearch } from './hooks/useStreamSearch.js';
import { sortStreams } from './api/twitch.js';
import { MOCK_STREAMS } from './mock/mockStreams.js';
import { activateChaos } from './chaos.js';
import { dpgkUrl } from './dpgkNav.js';

const DEMO_PARAM = new URLSearchParams(window.location.search).get('demo') === '1';

export default function App() {
  const [isDark, setIsDark] = useTheme();
  const { token, authError, authUrl } = useAuth();
  const channels = useChannels();
  const visited = useVisited();
  const [settings, updateSettings] = useSettings();

  const [demoMode, setDemoMode] = useState(DEMO_PARAM);
  const { streams, setStreams, gameInfo, status, searching, searchDemo, searchReal } = useStreamSearch(
    DEMO_PARAM ? sortStreams(MOCK_STREAMS, 'desc') : []
  );
  const [preview, setPreview] = useState(null);

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
  const handleSearch = useCallback(() => {
    if (demoMode) searchDemo(settings);
    else searchReal(token, settings);
  }, [demoMode, searchDemo, searchReal, token, settings]);

  const handleReset = useCallback(() => {
    if (!confirm('既視聴履歴をクリアしますか？\n(検索条件・お気に入り・除外リストは保持されます)')) return;
    visited.clearVisited();
  }, [visited]);

  const handleDemo = useCallback(() => {
    setDemoMode(true);
    searchDemo(settings);
  }, [searchDemo, settings]);

  const openDpgk = useCallback(() => {
    window.location.href = dpgkUrl({ demo: demoMode });
  }, [demoMode]);

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
            onZap={openDpgk}
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
