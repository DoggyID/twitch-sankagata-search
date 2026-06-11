import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { PLAYER_PARENT } from '../../config.js';
import { useZapControls } from './useZapControls.js';
import { useTwitchPlayer } from './useTwitchPlayer.js';

// DPGKモード（TikTok風ザッピング）。本体には手を付けず、独立した全画面オーバーレイ
export default function ZapMode({ favList, othersList, channels, visited, onClose }) {
  // 開いた時点のリストをスナップショット（操作中の増減で index がずれないように）
  const snapshot = useRef({
    favorites: favList,
    others: othersList,
  });

  const initialSource = othersList.length > 0 ? 'others' : 'favorites';
  const [source, setSource] = useState(initialSource);
  const [index, setIndex] = useState(0);
  const [flash, setFlash] = useState(null); // 操作フィードバック
  const [showChat, setShowChat] = useState(true);

  const list = snapshot.current[source] || [];
  const stream = list[index] || null;

  const showFlash = useCallback((msg) => {
    setFlash(msg);
    window.clearTimeout(showFlash._t);
    showFlash._t = window.setTimeout(() => setFlash(null), 700);
  }, []);

  const next = useCallback(() => {
    setIndex((i) => Math.min(i + 1, Math.max(0, list.length - 1)));
  }, [list.length]);

  const prev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const onFavorite = useCallback(() => {
    if (!stream) return;
    channels.addFavorite(stream.user_login);
    showFlash('⭐ お気に入りに追加');
    next();
  }, [stream, channels, next, showFlash]);

  const onVisited = useCallback(() => {
    if (!stream) return;
    visited.addVisited(stream);
    showFlash('✓ 既視聴にした');
    next();
  }, [stream, visited, next, showFlash]);

  const onExclude = useCallback(() => {
    if (!stream) return;
    channels.addExcluded(stream.user_login);
    showFlash('🚫 除外した');
    next();
  }, [stream, channels, next, showFlash]);

  const switchSource = useCallback((src) => {
    setSource(src);
    setIndex(0);
  }, []);

  const { onTouchStart, onTouchEnd } = useZapControls({
    onPrev: prev, onNext: next, onFavorite, onVisited, onExclude, onClose,
  });

  // プレイヤーは JS API で生成（素の iframe だとフォーカスを奪われ矢印キーが効かなくなる）。
  // 上に透明オーバーレイを被せて iframe にフォーカスを渡さず、ミュート等は自前ボタンで操作する。
  const playerId = useId().replace(/:/g, '');
  const { muted, toggleMute } = useTwitchPlayer(playerId, stream?.user_login);

  const onToggleMute = useCallback(() => {
    const m = toggleMute();
    showFlash(m ? '🔇 ミュート' : '🔊 ミュート解除');
  }, [toggleMute, showFlash]);

  const rootRef = useRef(null);
  useEffect(() => {
    rootRef.current?.focus({ preventScroll: true });
  }, []);

  const chatSrc = useMemo(() => {
    if (!stream) return '';
    return `https://www.twitch.tv/embed/${encodeURIComponent(stream.user_login)}/chat?parent=${encodeURIComponent(PLAYER_PARENT)}&darkpopout`;
  }, [stream]);

  return (
    <div
      className={`zap-overlay${showChat ? ' with-chat' : ''}`}
      ref={rootRef}
      tabIndex={-1}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="zap-topbar">
        <span className="zap-brand">DPGK</span>
        <div className="zap-source-toggle">
          <button
            type="button"
            className={`zap-source-btn${source === 'others' ? ' active' : ''}`}
            onClick={() => switchSource('others')}
          >
            その他 ({snapshot.current.others.length})
          </button>
          <button
            type="button"
            className={`zap-source-btn${source === 'favorites' ? ' active' : ''}`}
            onClick={() => switchSource('favorites')}
          >
            ⭐ お気に入り ({snapshot.current.favorites.length})
          </button>
        </div>
        <div className="zap-counter">{list.length > 0 ? `${index + 1} / ${list.length}` : '0 / 0'}</div>
        <button
          type="button"
          className="zap-chat-toggle"
          onClick={onToggleMute}
          title="音声のミュート切替"
        >
          {muted ? '🔇 ミュート中' : '🔊 音声オン'}
        </button>
        <button
          type="button"
          className={`zap-chat-toggle${showChat ? ' active' : ''}`}
          onClick={() => setShowChat((v) => !v)}
          title="チャットの表示/非表示"
        >
          💬 チャット
        </button>
        {stream && (
          <a
            className="zap-open-twitch"
            href={`https://twitch.tv/${stream.user_login}`}
            target="_blank"
            rel="noopener noreferrer"
            title="この配信をTwitchで開く"
          >
            Twitchで開く ↗
          </a>
        )}
        <button type="button" className="zap-close" aria-label="閉じる" onClick={onClose}>×</button>
      </div>

      <div className="zap-body">
        {stream ? (
          <>
            <div className="zap-main">
              <div className="zap-player">
                <div id={playerId} className="zap-player-embed" />
                {/* iframe にフォーカスを渡さないための透明オーバーレイ。タップでミュート切替 */}
                <button
                  type="button"
                  className="zap-player-overlay"
                  onClick={onToggleMute}
                  aria-label={muted ? 'ミュート解除' : 'ミュート'}
                  title="タップでミュート切替"
                />
                {muted && <div className="zap-mute-indicator">🔇</div>}
                {flash && <div className="zap-flash">{flash}</div>}
              </div>
              <div className="zap-meta">
                <strong className="zap-streamer">{stream.user_name}</strong>
                <span className="zap-title">{stream.title || '(タイトルなし)'}</span>
                <span className="zap-viewers">👁 {stream.viewer_count.toLocaleString()} 人</span>
                {stream.tags && stream.tags.length > 0 && (
                  <div className="zap-tags">
                    {stream.tags.map((tag) => (
                      <span key={tag} className="zap-tag">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {showChat && (
              <div className="zap-chat">
                <iframe key={`chat-${stream.user_login}`} src={chatSrc} title="Twitch chat" />
              </div>
            )}
          </>
        ) : (
          <div className="zap-empty">
            <p>このリストには表示できる配信がありません。</p>
            <p>上のボタンでリストを切り替えてください。</p>
          </div>
        )}
      </div>

      {/* 画面操作ボタン（タッチ/マウス用）。キーボードでも同じ操作が可能 */}
      <div className="zap-controls">
        <button type="button" className="zap-ctrl prev" onClick={prev} title="前へ (↑)">↑ 前へ</button>
        <button type="button" className="zap-ctrl next" onClick={next} title="次へ (↓)">↓ 次へ</button>
        <button type="button" className="zap-ctrl fav" onClick={onFavorite} title="お気に入り (→)">お気に入り →</button>
        <button type="button" className="zap-ctrl visited" onClick={onVisited} title="既視聴 (←)">← 既視聴</button>
        <button type="button" className="zap-ctrl exclude" onClick={onExclude} title="除外 (Delete)">🚫 除外</button>
      </div>

      <div className="zap-hint">
        ↑ 前へ ・ ↓ 次へ ・ → お気に入り ・ ← 既視聴 ・ Delete 除外 ・ Esc 閉じる（スワイプ上下でも操作可）
      </div>
    </div>
  );
}
