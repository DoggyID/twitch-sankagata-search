import { useEffect, useMemo, useRef, useState } from 'react';

let twitchScriptPromise = null;
let poolInstanceSeq = 0;

const SCRIPT_ID = 'twitch-player-embed-v1';
const SCRIPT_SRC = 'https://player.twitch.tv/js/embed/v1.js';
const LOW_QUALITY_CANDIDATES = ['160p30', '160p', '360p30', '360p'];
// プリロード本数の上限（active 1 + 最大3先読み）。スロット数は常にこの数で固定し、
// preloadCount が変わっても配列の再構築は発生させない（使わないスロットはidleのまま）。
export const MAX_PRELOAD_COUNT = 3;
const MAX_SLOTS = MAX_PRELOAD_COUNT + 1;

function loadTwitchScript() {
  if (window.Twitch?.Player) return Promise.resolve(window.Twitch);
  if (twitchScriptPromise) return twitchScriptPromise;

  twitchScriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.Twitch), { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.addEventListener('load', () => resolve(window.Twitch), { once: true });
    script.addEventListener('error', reject, { once: true });
    document.head.appendChild(script);
  });

  return twitchScriptPromise;
}

function normalizeLogin(login) {
  return login ? String(login).toLowerCase() : null;
}

function createSlot(instanceId, index) {
  return {
    key: `slot-${index}`,
    containerId: `zap-player-slot-${instanceId}-${index}`,
    login: null,
    role: 'idle',
    ready: false,
    playing: false,
    muted: true,
    quality: null,
    assignmentToken: 0,
    lastAssignedAt: 0,
    lastError: null,
    player: null,
    listenersAttached: false,
    desiredMuted: true,
  };
}

function cloneSlot(slot) {
  return {
    key: slot.key,
    containerId: slot.containerId,
    login: slot.login,
    role: slot.role,
    ready: slot.ready,
    playing: slot.playing,
    muted: slot.muted,
    quality: slot.quality,
    assignmentToken: slot.assignmentToken,
    lastAssignedAt: slot.lastAssignedAt,
    lastError: slot.lastError,
  };
}

function isLikelyMobileAutoplayBlocked() {
  return window.matchMedia?.('(hover: none) and (pointer: coarse)').matches ?? false;
}

function safeCall(fn, fallback = null) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function chooseLowQuality(qualities) {
  if (!Array.isArray(qualities) || qualities.length === 0) return null;
  return LOW_QUALITY_CANDIDATES.find((candidate) => qualities.includes(candidate)) ?? null;
}

function syncPlayerState(slot) {
  if (!slot.player) return;
  slot.muted = safeCall(() => slot.player.getMuted(), slot.desiredMuted);
  slot.quality = safeCall(() => slot.player.getQuality(), null);
}

export function planPlayerAssignments(slots, activeLogin, preloadLogins = []) {
  const active = normalizeLogin(activeLogin);
  const activeSlot = slots.find((slot) => normalizeLogin(slot.login) === active)
    ?? slots.find((slot) => slot.role === 'active')
    ?? slots[0];

  const used = new Set([activeSlot]);
  const preloads = [];

  // 近い順に、まず「すでにそのチャンネルを保持しているスロット」を再利用する
  const wanted = preloadLogins.map(normalizeLogin).filter((login) => login && login !== active);
  wanted.forEach((login) => {
    const existing = slots.find((slot) => !used.has(slot) && normalizeLogin(slot.login) === login);
    if (!existing) return;
    used.add(existing);
    preloads.push({ slotKey: existing.key, login });
  });

  // 未保持のチャンネルには、空いているスロットを割り当てる（スロットが尽きたら諦める）
  wanted.forEach((login) => {
    if (preloads.some((p) => p.login === login)) return;
    const free = slots.find((slot) => !used.has(slot));
    if (!free) return;
    used.add(free);
    preloads.push({ slotKey: free.key, login });
  });

  return {
    active: active ? { slotKey: activeSlot?.key, login: active } : null,
    preloads,
    idle: slots.filter((slot) => !used.has(slot)).map((slot) => slot.key),
    activeSlot,
  };
}

export function usePlayerPool(feed, index, options = {}) {
  const parent = options.parent;
  const enabled = options.enabled ?? true;
  const resetKey = options.resetKey ?? 0;
  const preloadCount = Math.max(0, Math.min(MAX_PRELOAD_COUNT, options.preloadCount ?? 1));
  const enablePreload = (options.enablePreload ?? !isLikelyMobileAutoplayBlocked()) && preloadCount > 0;
  const instanceIdRef = useRef(null);
  const mountedRef = useRef(false);
  const tokenSeqRef = useRef(0);
  const resetKeyRef = useRef(resetKey);
  const slotsRef = useRef(null);
  const [scriptReady, setScriptReady] = useState(!!window.Twitch?.Player);
  const [scriptError, setScriptError] = useState(null);
  const [snapshot, setSnapshot] = useState([]);
  const [activePaused, setActivePaused] = useState(false);

  if (!instanceIdRef.current) {
    poolInstanceSeq += 1;
    instanceIdRef.current = poolInstanceSeq;
  }

  if (!slotsRef.current) {
    slotsRef.current = Array.from({ length: MAX_SLOTS }, (_, i) => createSlot(instanceIdRef.current, i));
  }

  const publish = () => {
    const nextSnapshot = slotsRef.current.map(cloneSlot);
    setSnapshot(nextSnapshot);
    window.__dpgkPlayerPool = {
      slots: nextSnapshot,
      resetKey: resetKeyRef.current,
      scriptLoaded: scriptReady || !!window.Twitch?.Player,
      scriptError: scriptError?.message ?? null,
      activePaused,
    };
  };

  const attachListeners = (slot) => {
    if (slot.listenersAttached || !slot.player || !window.Twitch?.Player) return;
    const Player = window.Twitch.Player;
    const events = [
      Player.READY,
      Player.PLAY,
      Player.PLAYING,
      Player.PAUSE,
      Player.ONLINE,
      Player.OFFLINE,
      Player.PLAYBACK_BLOCKED,
    ].filter(Boolean);

    events.forEach((eventName) => {
      slot.player.addEventListener(eventName, () => {
        if (!mountedRef.current || !slot.player) return;
        const currentChannel = normalizeLogin(safeCall(() => slot.player.getChannel(), slot.login));
        if (slot.login && currentChannel && currentChannel !== normalizeLogin(slot.login)) return;

        if (eventName === Player.READY) slot.ready = true;
        if (eventName === Player.PLAY || eventName === Player.PLAYING) {
          slot.ready = true;
          slot.playing = true;
          if (slot.role === 'active') setActivePaused(false);
        }
        if (eventName === Player.PAUSE) {
          slot.playing = false;
          if (slot.role === 'active') setActivePaused(true);
        }
        if (eventName === Player.PLAYBACK_BLOCKED) {
          slot.lastError = 'playback blocked';
          // ミュート無しでの自動再生がブラウザにブロックされた場合、ミュートして再試行する。
          // ここで何もしないと、assignSlot は同じチャンネル・同じroleへの再呼び出しを
          // 早期returnするため、ユーザーが手動操作しない限り永遠に再生が始まらない。
          if (!slot.desiredMuted) {
            slot.desiredMuted = true;
            safeCall(() => slot.player.setMuted(true));
            safeCall(() => slot.player.play());
          }
        }

        safeCall(() => slot.player.setMuted(slot.desiredMuted));
        if (eventName === Player.PLAYING) {
          syncPlayerState(slot);
          applyQualityPreference(slot);
        }
        publish();
      });
    });

    slot.listenersAttached = true;
  };

  const applyQualityPreference = (slot) => {
    if (!slot.player || !slot.ready) return;
    const qualities = safeCall(() => slot.player.getQualities(), []);
    if (!Array.isArray(qualities) || qualities.length === 0) return;

    if (slot.role === 'active') {
      if (qualities.includes('chunked')) safeCall(() => slot.player.setQuality('chunked'));
      return;
    }

    const lowQuality = chooseLowQuality(qualities);
    if (lowQuality) safeCall(() => slot.player.setQuality(lowQuality));
  };

  const settleSlotSoon = (slot, token) => {
    window.setTimeout(() => {
      if (!mountedRef.current || slot.assignmentToken !== token || !slot.player) return;
      const currentChannel = normalizeLogin(safeCall(() => slot.player.getChannel(), slot.login));
      if (slot.login && currentChannel && currentChannel !== normalizeLogin(slot.login)) return;
      if (slot.login && currentChannel === normalizeLogin(slot.login)) slot.ready = true;
      safeCall(() => slot.player.setMuted(slot.desiredMuted));
      if (slot.role !== 'idle') safeCall(() => slot.player.play());
      syncPlayerState(slot);
      applyQualityPreference(slot);
      publish();
    }, 900);
  };

  const assignSlot = (slot, login, role, twitch) => {
    const normalizedLogin = normalizeLogin(login);
    const shouldChangeChannel = normalizedLogin && normalizeLogin(slot.login) !== normalizedLogin;

    // チャンネルもroleも変わっていない（同じスロットへの再確認呼び出し）場合は何もしない。
    // ここで play() を無条件に呼び直すと、ユーザーが active スロットを一時停止した直後に
    // 再生を再開させてしまう（activePaused の再計算で本effectが再実行されるため）。
    if (!shouldChangeChannel && slot.role === role) return;

    const token = tokenSeqRef.current + 1;
    tokenSeqRef.current = token;

    slot.assignmentToken = token;
    slot.login = normalizedLogin;
    slot.role = role;
    slot.desiredMuted = role !== 'active';
    slot.lastAssignedAt = Date.now();
    slot.lastError = null;
    if (shouldChangeChannel) {
      slot.ready = false;
      slot.playing = false;
      slot.quality = null;
    }

    const container = document.getElementById(slot.containerId);
    if (!container || !normalizedLogin) {
      publish();
      return;
    }

    if (!slot.player) {
      container.textContent = '';
      slot.player = new twitch.Player(slot.containerId, {
        width: '100%',
        height: '100%',
        channel: normalizedLogin,
        parent: [parent],
        muted: slot.desiredMuted,
        autoplay: true,
      });
      attachListeners(slot);
    } else if (shouldChangeChannel) {
      safeCall(() => slot.player.setMuted(true));
      safeCall(() => slot.player.setChannel(normalizedLogin));
    }

    safeCall(() => slot.player.setMuted(slot.desiredMuted));
    if (role === 'idle') {
      safeCall(() => slot.player.pause());
    } else {
      safeCall(() => slot.player.play());
    }
    syncPlayerState(slot);
    settleSlotSoon(slot, token);
    publish();
  };

  const idleSlot = (slot, clearLogin = false) => {
    const token = tokenSeqRef.current + 1;
    tokenSeqRef.current = token;
    slot.assignmentToken = token;
    slot.role = 'idle';
    slot.desiredMuted = true;
    slot.muted = true;
    slot.playing = false;
    slot.ready = false;
    slot.quality = null;
    slot.lastAssignedAt = Date.now();
    if (clearLogin) slot.login = null;
    if (slot.player) {
      safeCall(() => slot.player.setMuted(true));
      safeCall(() => slot.player.pause());
      // pause() だけでは配信(ライブ)側の通信が裏で継続する可能性があるため、
      // iframeごと破棄して確実にロード/視聴セッションを終了させる。
      // 次にこのスロットが使われる時は assignSlot が player を作り直す。
      const container = document.getElementById(slot.containerId);
      if (container) container.textContent = '';
      slot.player = null;
      slot.listenersAttached = false;
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    publish();
    if (!enabled) return () => {
      mountedRef.current = false;
    };

    loadTwitchScript()
      .then(() => {
        if (!mountedRef.current) return;
        setScriptReady(true);
        setScriptError(null);
        publish();
      })
      .catch((error) => {
        if (!mountedRef.current) return;
        setScriptError(error);
        publish();
      });

    return () => {
      mountedRef.current = false;
      slotsRef.current.forEach((slot) => {
        idleSlot(slot);
        slot.assignmentToken += 1;
      });
    };
    // The loader is intentionally mounted once for the lifetime of this hook.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  useEffect(() => {
    resetKeyRef.current = resetKey;
    slotsRef.current.forEach((slot) => idleSlot(slot, true));
    publish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  useEffect(() => {
    if (!enabled || !parent || !scriptReady || !window.Twitch?.Player || scriptError) return;

    const activeLogin = feed[index]?.user_login ?? null;
    const preloadLogins = enablePreload && !activePaused
      ? Array.from({ length: preloadCount }, (_, i) => feed[index + 1 + i]?.user_login).filter(Boolean)
      : [];
    const slots = slotsRef.current;

    if (!activeLogin) {
      slots.forEach((slot) => idleSlot(slot, true));
      publish();
      return;
    }

    const plan = planPlayerAssignments(slots, activeLogin, preloadLogins);
    const twitch = window.Twitch;

    if (plan.active?.slotKey) {
      const slot = slots.find((candidate) => candidate.key === plan.active.slotKey);
      assignSlot(slot, plan.active.login, 'active', twitch);
    }

    plan.preloads.forEach(({ slotKey, login }) => {
      const slot = slots.find((candidate) => candidate.key === slotKey);
      if (slot) assignSlot(slot, login, 'preload', twitch);
    });

    slots
      .filter((slot) => slot.role !== 'active' && !plan.preloads.some((p) => p.slotKey === slot.key))
      .forEach((slot) => idleSlot(slot, true));

    publish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed, index, parent, enabled, enablePreload, preloadCount, scriptReady, scriptError, activePaused]);

  const slots = snapshot.length > 0 ? snapshot : slotsRef.current.map(cloneSlot);

  return useMemo(() => ({
    slots,
    scriptError,
    scriptReady,
    preloadEnabled: enablePreload,
    preloadCount,
    activePaused,
  }), [slots, scriptError, scriptReady, enablePreload, preloadCount, activePaused]);
}
