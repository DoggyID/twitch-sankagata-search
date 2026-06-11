import { useEffect, useRef } from 'react';

// キーボード（矢印 / Delete / Esc）とタッチスワイプ（上下）の操作をまとめる
export function useZapControls({ onPrev, onNext, onFavorite, onVisited, onExclude, onClose }) {
  useEffect(() => {
    const handler = (e) => {
      switch (e.key) {
        case 'ArrowUp': e.preventDefault(); onPrev(); break;
        case 'ArrowDown': e.preventDefault(); onNext(); break;
        case 'ArrowRight': e.preventDefault(); onFavorite(); break;
        case 'ArrowLeft': e.preventDefault(); onVisited(); break;
        case 'Delete': e.preventDefault(); onExclude(); break;
        case 'Escape': e.preventDefault(); onClose(); break;
        default: break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onPrev, onNext, onFavorite, onVisited, onExclude, onClose]);

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
