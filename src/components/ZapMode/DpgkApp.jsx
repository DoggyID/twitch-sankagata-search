import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../hooks/useAuth.js';
import { useChannels } from '../../hooks/useChannels.js';
import { useVisited } from '../../hooks/useVisited.js';
import { useSettings } from '../../hooks/useSettings.js';
import { useStreamSearch } from '../../hooks/useStreamSearch.js';
import { sortStreams } from '../../api/twitch.js';
import { MOCK_STREAMS } from '../../mock/mockStreams.js';
import { PLAYER_PARENT } from '../../config.js';
import { homeUrl } from '../../dpgkNav.js';
import SearchFilters from '../SearchFilters.jsx';
import { useZapControls } from './useZapControls.js';
import { useFeed } from '../../hooks/useFeed.js';
import { usePlayerPool } from './usePlayerPool.js';

const DEMO_PARAM = new URLSearchParams(window.location.search).get('demo') === '1';

// DPGKモード専用ページ（dpgk.html）。本体の検索画面とは独立して読み込まれ、
// このページ単体で検索〜ザッピングまで完結する。お気に入り/除外/既視聴は
// localStorage 経由で本体と共有され、操作は即座にフィードへ反映される。
export default function DpgkApp() {
  const { token } = useAuth();
  const channels = useChannels();
  const visited = useVisited();
  const [settings, updateSettings] = useSettings();
  const [demoMode] = useState(DEMO_PARAM);
  const search = useStreamSearch(DEMO_PARAM ? sortStreams(MOCK_STREAMS, 'desc') : []);

  const [source, setSource] = useState('others');
  const [index, setIndex] = useState(0);
  const [flash, setFlash] = useState(null);
  const [showChat, setShowChat] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [poolResetKey, setPoolResetKey] = useState(0);

  const authed = !!token || demoMode;

  // --- ライブフィード（streams × お気に入り/除外/既視聴 を都度算出） ---
  // 既視聴・除外は常に除外。これにより前へ戻っても既視聴済みは出てこない。
  const { favList, othersList, counts } = useFeed(search.streams, channels, visited);
  const feed = useMemo(() => (source === 'favorites' ? favList : othersList), [source, favList, othersList]);
  const safeIndex = feed.length === 0 ? 0 : Math.min(index, feed.length - 1);

  const current = feed[safeIndex] || null;

  // フィードが縮んで index がはみ出したら詰める（末尾を操作した時など）
  useEffect(() => {
    if (feed.length === 0) {
      if (index !== 0) setIndex(0);
    } else if (index >= feed.length) {
      setIndex(feed.length - 1);
    }
  }, [feed.length, index]);

  const showFlash = useCallback((msg) => {
    setFlash(msg);
    window.clearTimeout(showFlash._t);
    showFlash._t = window.setTimeout(() => setFlash(null), 700);
  }, []);

  // --- プレイヤー ---
  const playerSrc = useMemo(() => {
    if (!current) return '';
    return `https://player.twitch.tv/?channel=${encodeURIComponent(current.user_login)}&parent=${encodeURIComponent(PLAYER_PARENT)}&muted=false&autoplay=true`;
  }, [current]);
  const playerPool = usePlayerPool(feed, safeIndex, {
    enabled: authed,
    parent: PLAYER_PARENT,
    resetKey: poolResetKey,
  });

  // --- ナビゲーション ---
  const next = useCallback(() => {
    setIndex((i) => Math.min(i + 1, Math.max(0, feed.length - 1)));
  }, [feed.length]);
  const prev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  // --- 操作（フィードへ即時反映。current がフィードから外れることで自動的に次へ進む） ---
  const onFavorite = useCallback(() => {
    if (!current) return;
    channels.addFavorite(current.user_login);
    showFlash('⭐ お気に入りに追加');
  }, [current, channels, showFlash]);

  const onVisited = useCallback(() => {
    if (!current) return;
    visited.addVisited(current);
    showFlash('✓ 既視聴にした');
  }, [current, visited, showFlash]);

  const onExclude = useCallback(() => {
    if (!current) return;
    channels.addExcluded(current.user_login);
    showFlash('🚫 除外した');
  }, [current, channels, showFlash]);

  const onOpenTwitch = useCallback(() => {
    if (!current) return;
    window.open(`https://twitch.tv/${current.user_login}`, '_blank', 'noopener,noreferrer');
  }, [current]);

  const onClose = useCallback(() => {
    window.location.href = homeUrl({ demo: demoMode });
  }, [demoMode]);

  const switchSource = useCallback((src) => {
    setSource(src);
    setIndex(0);
    setPoolResetKey((key) => key + 1);
  }, []);

  const { onTouchStart, onTouchEnd } = useZapControls({
    onPrev: prev, onNext: next, onFavorite, onVisited, onExclude, onClose,
    onOpenTwitch,
  });

  // --- 検索 ---
  const handleSearch = useCallback(() => {
    if (demoMode) search.searchDemo(settings);
    else search.searchReal(token, settings);
    setIndex(0);
    setPoolResetKey((key) => key + 1);
  }, [demoMode, search, settings, token]);

  const handleReset = useCallback(() => {
    if (!confirm('既視聴履歴をクリアしますか？\n(検索条件・お気に入り・除外リストは保持されます)')) return;
    visited.clearVisited();
  }, [visited]);

  // 並び替え変更で即時並べ直し（検索を待たない）
  const firstSort = useRef(true);
  useEffect(() => {
    if (firstSort.current) { firstSort.current = false; return; }
    search.setStreams((prev) => (prev.length > 0 ? sortStreams(prev, settings.sortOrder) : prev));
  }, [settings.sortOrder]);

  // 初回ロード時、保存済み条件で自動検索（本体からの遷移で即フィード表示）
  const didAuto = useRef(false);
  useEffect(() => {
    if (didAuto.current) return;
    if (demoMode) { didAuto.current = true; search.searchDemo(settings); return; }
    if (token && search.streams.length === 0 && settings.gameName.trim()) {
      didAuto.current = true;
      search.searchReal(token, settings);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const rootRef = useRef(null);
  const reclaimFocus = useCallback(() => {
    if (document.activeElement && document.activeElement.tagName === 'IFRAME') {
      rootRef.current?.focus({ preventScroll: true });
    }
  }, []);
  useEffect(() => { rootRef.current?.focus({ preventScroll: true }); }, []);

  const chatSrc = useMemo(() => {
    if (!current) return '';
    return `https://www.twitch.tv/embed/${encodeURIComponent(current.user_login)}/chat?parent=${encodeURIComponent(PLAYER_PARENT)}&darkpopout`;
  }, [current]);

  if (!authed) {
    return (
      <div className="zap-overlay zap-gate">
        <div className="zap-gate-box">
          <h1 className="zap-brand">DPGK モード</h1>
          <p>このページで配信を検索・視聴するには Twitch 認証が必要です。</p>
          <p>検索画面でログインすると、このページでもそのまま使えます。</p>
          <div className="zap-gate-actions">
            <a className="zap-open-twitch" href={homeUrl()}>検索画面へ（ログイン）</a>
            <a className="zap-chat-toggle" href={homeUrl({ demo: true })}>デモを見る</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`zap-overlay${showChat ? ' with-chat' : ''}`}
      ref={rootRef}
      onMouseMove={reclaimFocus}
      onMouseDown={reclaimFocus}
      tabIndex={-1}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="zap-topbar">
        <span className="zap-brand">DPGK</span>
        <button
          type="button"
          className={`zap-chat-toggle${showSearch ? ' active' : ''}`}
          onClick={() => setShowSearch((v) => !v)}
          title="検索条件を開く"
        >
          🔍 検索
        </button>
        <div className="zap-source-toggle">
          <button
            type="button"
            className={`zap-source-btn${source === 'others' ? ' active' : ''}`}
            onClick={() => switchSource('others')}
          >
            その他 ({counts.others})
          </button>
          <button
            type="button"
            className={`zap-source-btn${source === 'favorites' ? ' active' : ''}`}
            onClick={() => switchSource('favorites')}
          >
            ⭐ お気に入り ({counts.fav})
          </button>
        </div>
        <div className="zap-counter">{feed.length > 0 ? `${safeIndex + 1} / ${feed.length}` : '0 / 0'}</div>
        <button
          type="button"
          className={`zap-chat-toggle${showChat ? ' active' : ''}`}
          onClick={() => setShowChat((v) => !v)}
          title="チャットの表示/非表示"
        >
          💬 チャット
        </button>
        <button type="button" className="zap-close" aria-label="DPGKモードを退出" onClick={onClose}>← 退出</button>
      </div>

      {showSearch && (
        <div className="zap-search-panel">
          <SearchFilters
            settings={settings}
            token={demoMode ? null : token}
            onChange={updateSettings}
            onSearch={handleSearch}
            onReset={handleReset}
            searching={search.searching}
          />
          {search.status && <p className="zap-search-status">{search.status}</p>}
        </div>
      )}

      <div className="zap-body">
        <div className="zap-main">
          <div className={`zap-player${current ? '' : ' empty'}${playerPool.scriptError ? ' fallback' : ''}`}>
            {playerPool.scriptError ? (
              playerSrc && (
                <iframe
                  key={current.user_login}
                  src={playerSrc}
                  allowFullScreen
                  allow="autoplay; encrypted-media"
                  title="Twitch DPGK player"
                />
              )
            ) : (
              <div className="zap-player-pool" aria-hidden={!current}>
                {playerPool.slots.map((slot) => (
                  <div
                    key={slot.key}
                    id={slot.containerId}
                    className={`zap-player-slot ${slot.role}`}
                    data-login={slot.login || ''}
                    data-ready={slot.ready ? 'true' : 'false'}
                    data-playing={slot.playing ? 'true' : 'false'}
                  />
                ))}
              </div>
            )}
            {!current && (
              <div className="zap-empty">
                <p>表示できる配信がありません。</p>
                <p>🔍 検索で配信を探すか、上のボタンでリストを切り替えてください。</p>
              </div>
            )}
            {flash && <div className="zap-flash">{flash}</div>}
          </div>

          {current && (
            <>
              <div className="zap-controls">
                <button type="button" className="zap-ctrl prev" onClick={prev} title="前へ (↑)">↑ 前へ</button>
                <button type="button" className="zap-ctrl next" onClick={next} title="次へ (↓)">↓ 次へ</button>
                <button type="button" className="zap-ctrl visited" onClick={onVisited} title="既視聴 (←)">← 既視聴</button>
                <button type="button" className="zap-ctrl fav" onClick={onFavorite} title="お気に入り (→)">お気に入り →</button>
                <button type="button" className="zap-ctrl exclude" onClick={onExclude} title="除外 (Delete)">🚫 除外</button>
                <a
                  className="zap-ctrl open-twitch"
                  href={current ? `https://twitch.tv/${current.user_login}` : '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Twitchで開く (Enter)"
                >
                  Twitchで開く ↗
                </a>
              </div>
              <div className="zap-meta">
                <strong className="zap-streamer">{current.user_name}</strong>
                <span className="zap-title">{current.title || '(タイトルなし)'}</span>
                <span className="zap-viewers">👁 {current.viewer_count.toLocaleString()} 人</span>
                {current.tags && current.tags.length > 0 && (
                  <div className="zap-tags">
                    {current.tags.map((tag) => (
                      <span key={tag} className="zap-tag">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        {current && showChat && (
          <div className="zap-chat">
            <iframe key={`chat-${current.user_login}`} src={chatSrc} title="Twitch chat" />
          </div>
        )}
      </div>

      <div className="zap-hint">
          ↑ 前へ ・ ↓ 次へ ・ → お気に入り ・ ← 既視聴 ・ Delete 除外 ・ Enter Twitchで開く ・ Esc 戻る（スワイプ上下でも操作可。再生・音量はTwitchプレイヤー本体のコントロールを使用）
      </div>
    </div>
  );
}
