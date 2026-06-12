import { useCallback, useEffect, useRef, useState } from 'react';
import { PLAYER_PARENT } from '../../config.js';

// Twitch Player JS API（embed v1）を一度だけ読み込む
let scriptPromise = null;
function loadTwitchScript() {
  if (window.Twitch && window.Twitch.Player) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://player.twitch.tv/js/embed/v1.js';
    s.async = true;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return scriptPromise;
}

// DPGKモード用プレイヤー。フォーカスを奪う素の iframe ではなく JS API で生成し、
// 親からミュートなどを制御できるようにする（操作は被せたオーバーレイ側で行う）
export function useTwitchPlayer(containerId, channel) {
  const playerRef = useRef(null);
  const pausedRef = useRef(false);
  const [muted, setMuted] = useState(false);
  const [paused, setPausedState] = useState(false);

  const setPaused = useCallback((v) => { pausedRef.current = v; setPausedState(v); }, []);

  // 生成（初回 channel が来たとき）／チャンネル切替（setChannel で再読込なし）
  useEffect(() => {
    if (!channel) return;
    let cancelled = false;
    loadTwitchScript().then(() => {
      if (cancelled) return;
      if (!document.getElementById(containerId)) return;
      if (!playerRef.current) {
        const Player = window.Twitch.Player;
        const p = new Player(containerId, {
          channel,
          parent: [PLAYER_PARENT],
          width: '100%',
          height: '100%',
          muted: false,
          autoplay: true,
        });
        playerRef.current = p;
        p.addEventListener(Player.READY, () => {
          if (!cancelled) setMuted(p.getMuted());
        });
        p.addEventListener(Player.PLAY, () => { if (!cancelled) setPaused(false); });
        p.addEventListener(Player.PLAYING, () => { if (!cancelled) setPaused(false); });
        p.addEventListener(Player.PAUSE, () => { if (!cancelled) setPaused(true); });
      } else {
        playerRef.current.setChannel(channel);
        setPaused(false);
      }
    });
    return () => { cancelled = true; };
  }, [channel, containerId, setPaused]);

  const toggleMute = useCallback(() => {
    const p = playerRef.current;
    if (!p) return muted;
    const next = !p.getMuted();
    p.setMuted(next);
    if (!next && p.getVolume() === 0) p.setVolume(0.5);
    setMuted(next);
    return next;
  }, [muted]);

  const togglePlay = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    if (pausedRef.current) p.play();
    else p.pause();
    // イベントが来る前に UI を即時反映（PLAY/PAUSE イベントで最終整合）
    setPaused(!pausedRef.current);
  }, [setPaused]);

  return { muted, toggleMute, paused, togglePlay };
}
