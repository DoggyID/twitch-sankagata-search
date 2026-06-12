import { useEffect, useRef } from 'react';

// 入力欄にフォーカスがある時はショートカットを無効化（検索クエリの入力を邪魔しない）
function isTyping(target) {
  if (!target) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

// キーボードとタッチスワイプ（上下）の操作をまとめる
export function useZapControls({
  onPrev, onNext, onFavorite, onVisited, onExclude, onClose,
  onPlayPause, onMute, onOpenTwitch,
}) {
  useEffect(() => {
    const handler = (e) => {
      if (isTyping(e.target)) return;
      switch (e.key) {
        case 'ArrowUp': e.preventDefault(); onPrev(); break;
        case 'ArrowDown': e.preventDefault(); onNext(); break;
        case 'ArrowRight': e.preventDefault(); onFavorite(); break;
        case 'ArrowLeft': e.preventDefault(); onVisited(); break;
        case 'Delete': e.preventDefault(); onExclude(); break;
        case 'Escape': e.preventDefault(); onClose(); break;
        case ' ':
        case 'Spacebar': // 古いブラウザ向けエイリアス
        case 'MediaPlayPause': e.preventDefault(); onPlayPause?.(); break;
        case 'm':
        case 'M': e.preventDefault(); onMute?.(); break;
        case 'Enter': e.preventDefault(); onOpenTwitch?.(); break;
        default: break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onPrev, onNext, onFavorite, onVisited, onExclude, onClose, onPlayPause, onMute, onOpenTwitch]);

  const startY = useRef(0);
  const onTouchStart = (e) => { startY.current = e.touches[0].clientY; };
  const onTouchEnd = (e) => {
    const dy = e.changedTouches[0].clientY - startY.current;
    if (Math.abs(dy) < 50) return;
    if (dy < 0) onNext(); // 上スワイプ = 次へ（TikTok準拠）
    else onPrev();        // 下スワイプ = 前へ
  };

  return { onTouchStart, onTouchEnd };
}
