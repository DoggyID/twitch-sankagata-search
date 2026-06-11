import { useCallback, useMemo, useRef, useState } from 'react';
import { PLAYER_PARENT } from '../../config.js';
import { useZapControls } from './useZapControls.js';

// TikTok風ザッピングモード（本体には手を付けず、独立した全画面オーバーレイ）
export default function ZapMode({ favList, othersList, channels, visited, onClose }) {
  // 開いた時点のリストをスナップショット（ザッピング中の増減で index がずれないように）
  const snapshot = useRef({
    favorites: favList,
    others: othersList,
  });

  const initialSource = othersList.length > 0 ? 'others' : 'favorites';
  const [source, setSource] = useState(initialSource);
  const [index, setIndex] = useState(0);
  const [flash, setFlash] = useState(null); // 操作フィードバック

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

  const playerSrc = useMemo(() => {
    if (!stream) return '';
    return `https://player.twitch.tv/?channel=${encodeURIComponent(stream.user_login)}&parent=${encodeURIComponent(PLAYER_PARENT)}&muted=true&autoplay=true`;
  }, [stream]);

  return (
    <div className="zap-overlay" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="zap-topbar">
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
        <button type="button" className="zap-close" aria-label="閉じる" onClick={onClose}>×</button>
      </div>

      <div className="zap-stage">
        {stream ? (
          <>
            <div className="zap-player">
              <iframe
                key={stream.user_login}
                src={playerSrc}
                allowFullScreen
                allow="autoplay; encrypted-media"
                title="Twitch zap player"
              />
            </div>
            <div className="zap-meta">
              <strong className="zap-streamer">{stream.user_name}</strong>
              <span className="zap-title">{stream.title || '(タイトルなし)'}</span>
              <span className="zap-viewers">👁 {stream.viewer_count.toLocaleString()} 人</span>
            </div>
            {flash && <div className="zap-flash">{flash}</div>}
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
        <button type="button" className="zap-ctrl visited" onClick={onVisited} title="既視聴 (←)">← 既視聴</button>
        <button type="button" className="zap-ctrl exclude" onClick={onExclude} title="除外 (Delete)">🚫 除外</button>
        <button type="button" className="zap-ctrl fav" onClick={onFavorite} title="お気に入り (→)">お気に入り →</button>
        <button type="button" className="zap-ctrl next" onClick={next} title="次へ (↓)">↓ 次へ</button>
      </div>

      <div className="zap-hint">
        ↑↓ 前後 ・ → お気に入り ・ ← 既視聴 ・ Delete 除外 ・ Esc 閉じる（スワイプ上下でも操作可）
      </div>
    </div>
  );
}
