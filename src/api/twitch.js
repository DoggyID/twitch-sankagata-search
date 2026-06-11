import { CLIENT_ID } from '../config.js';

const HELIX = 'https://api.twitch.tv/helix';

function headers(token) {
  return { Authorization: `Bearer ${token}`, 'Client-ID': CLIENT_ID };
}

// ゲーム名 → ゲーム情報（{id, name, box_art_url}）。見つからなければ null
export async function getGameByName(token, name) {
  const res = await fetch(`${HELIX}/games?name=${encodeURIComponent(name)}`, { headers: headers(token) });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Error ${res.status}: ${data.message || 'ゲーム情報の取得に失敗しました。'}`);
  }
  return data.data && data.data.length > 0 ? data.data[0] : null;
}

// game_id の全ライブ配信をページングで取得
export async function fetchAllStreams(token, gameId, language, onProgress) {
  let all = [];
  let cursor = null;
  let page = 1;
  do {
    let url = `${HELIX}/streams?game_id=${encodeURIComponent(gameId)}&first=100`;
    if (language) url += `&language=${language}`;
    if (cursor) url += `&after=${cursor}`;

    const res = await fetch(url, { headers: headers(token) });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(`Error ${res.status}: ${err.message || 'ストリーム情報の取得に失敗しました。'}`);
    }
    const data = await res.json();
    if (data.data && data.data.length > 0) all.push(...data.data);
    cursor = data.pagination?.cursor;
    if (onProgress) onProgress(all.length, page);
    if (cursor) await new Promise((r) => setTimeout(r, 300));
    page++;
  } while (cursor);
  return all;
}

// user_id[] → { user_id: profile_image_url } を100件ずつ取得
export async function fetchUserProfiles(token, userIds) {
  const profiles = {};
  for (let i = 0; i < userIds.length; i += 100) {
    const batch = userIds.slice(i, i + 100);
    const url = `${HELIX}/users?` + batch.map((id) => `id=${id}`).join('&');
    const res = await fetch(url, { headers: headers(token) });
    const data = await res.json();
    if (data.data) data.data.forEach((u) => { profiles[u.id] = u.profile_image_url; });
    if (i + 100 < userIds.length) await new Promise((r) => setTimeout(r, 300));
  }
  return profiles;
}

// クライアント側フィルタ（タイトル/タグ/除外タグ/最大視聴者数）
export function filterStreams(streams, settings) {
  const titleQuery = (settings.titleQuery || '').trim().toLowerCase();
  const tagQueries = (settings.tagInput || '').split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
  const excludeTagQueries = (settings.excludeTagInput || '').split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
  const maxViewers = parseInt((settings.maxViewers ?? '').toString().trim(), 10);
  const tagLogic = settings.tagLogic || 'OR';

  let out = streams;
  if (titleQuery) {
    out = out.filter((s) => s.title && s.title.toLowerCase().includes(titleQuery));
  }
  if (tagQueries.length > 0) {
    out = out.filter((s) => {
      if (!s.tags || s.tags.length === 0) return false;
      const lower = s.tags.map((t) => t.toLowerCase());
      return tagLogic === 'AND'
        ? tagQueries.every((q) => lower.includes(q))
        : tagQueries.some((q) => lower.includes(q));
    });
  }
  if (excludeTagQueries.length > 0) {
    out = out.filter((s) => {
      if (!s.tags || s.tags.length === 0) return true;
      const lower = s.tags.map((t) => t.toLowerCase());
      return !excludeTagQueries.some((q) => lower.includes(q));
    });
  }
  if (!isNaN(maxViewers) && maxViewers >= 0) {
    out = out.filter((s) => s.viewer_count <= maxViewers);
  }
  return out;
}

export function sortStreams(streams, sortOrder) {
  const sorted = [...streams];
  if (sortOrder === 'asc') sorted.sort((a, b) => a.viewer_count - b.viewer_count);
  else sorted.sort((a, b) => b.viewer_count - a.viewer_count);
  return sorted;
}
