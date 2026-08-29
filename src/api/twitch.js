import { CLIENT_ID } from '../config.js';

const HELIX = 'https://api.twitch.tv/helix';
const DEFAULT_MAX_STREAMS = 1000;

function headers(token) {
  return { Authorization: `Bearer ${token}`, 'Client-ID': CLIENT_ID };
}

// Helix は 800ポイント/分（≒13リクエスト/秒）。検索1回のページングは多くても20回程度で、
// 通常は上限にまったく触れない。そのため待ち時間は固定で入れず、
// 実際に 429 が返ったときだけ Ratelimit-Reset に従って待つ。
async function helixFetch(token, url, retries = 2) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: headers(token) });
    if (res.status !== 429 || attempt >= retries) return res;
    const reset = Number(res.headers.get('Ratelimit-Reset'));
    const waitMs = Number.isFinite(reset) && reset > 0
      ? Math.max(0, reset * 1000 - Date.now()) + 100
      : 1000 * (attempt + 1);
    await new Promise((r) => setTimeout(r, Math.min(waitMs, 5000)));
  }
}

async function helixJson(token, url, errorMessage) {
  const res = await helixFetch(token, url);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Error ${res.status}: ${data.message || errorMessage}`);
  }
  return data;
}

// ゲーム名 → ゲーム情報（{id, name, box_art_url}）。見つからなければ null
export async function getGameByName(token, name) {
  const data = await helixJson(
    token,
    `${HELIX}/games?name=${encodeURIComponent(name)}`,
    'ゲーム情報の取得に失敗しました。'
  );
  return data.data && data.data.length > 0 ? data.data[0] : null;
}

// Helix が「検索クエリ」として受け付ける構造化パラメータはこれだけ。
// いずれもID・コード値の完全一致で、あいまい検索は挟まらない。
// 同じキーの繰り返しは OR、違うキー同士は AND で効く。
// タイトル・タグ・視聴者数に相当するパラメータは存在しないため、そこはクライアント側で絞る。
const HELIX_MAX_VALUES = 100;

function appendAll(params, key, values) {
  if (!Array.isArray(values)) return 0;
  const list = values.filter(Boolean).slice(0, HELIX_MAX_VALUES);
  list.forEach((v) => params.append(key, v));
  return list.length;
}

export function buildStreamsUrl(query = {}, cursor = null) {
  const { gameIds, languages, userLogins, userIds, type = 'live' } = query;
  const params = new URLSearchParams();
  params.set('first', '100');
  if (type) params.set('type', type);
  appendAll(params, 'game_id', gameIds);
  appendAll(params, 'language', languages);
  appendAll(params, 'user_login', userLogins);
  appendAll(params, 'user_id', userIds);
  if (cursor) params.set('after', cursor);
  return `${HELIX}/streams?${params.toString()}`;
}

// ライブ配信を1ページ100件ずつ取得し、ページごとに onPage へ渡す。
// onPage が false を返した時点で打ち切る（呼び出し側が「もう十分」と判断できるようにするため）。
// Twitch は viewer_count 降順で返すので、降順表示なら先頭から必要数を集めた時点で止めてよい。
export async function fetchStreams(token, query, opts = {}) {
  const { maxStreams = DEFAULT_MAX_STREAMS, onPage } = opts;
  let cursor = null;
  let fetched = 0;
  let capped = false;
  let stoppedEarly = false;

  do {
    const url = buildStreamsUrl(query, cursor);
    const data = await helixJson(token, url, 'ストリーム情報の取得に失敗しました。');
    const page = data.data || [];
    fetched += page.length;

    const wantMore = onPage ? (await onPage(page, fetched)) !== false : true;

    if (maxStreams && fetched >= maxStreams) { capped = true; break; }
    if (!wantMore) { stoppedEarly = true; break; }

    cursor = data.pagination?.cursor;
  } while (cursor);

  return { fetched, capped, stoppedEarly };
}

// user_id[] → いまライブ中の配信だけを返す。
// Helix は「ライブでないチャンネルは応答に含めない」ので、
// 投げたIDのうち返ってこなかったものがオフライン。
// 1リクエストに100IDまで載るため、1000チャンネルでも10リクエストで済む。
export async function fetchLiveStreamsByUserIds(token, userIds) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  const batches = [];
  for (let i = 0; i < ids.length; i += HELIX_MAX_VALUES) {
    batches.push(ids.slice(i, i + HELIX_MAX_VALUES));
  }

  const results = await Promise.all(
    batches.map(async (batch) => {
      // user_id だけで引く。game_id を混ぜると結合規則に依存するため、
      // ゲームやタイトルの絞り込みは取得後にこちらでかける。
      const url = buildStreamsUrl({ userIds: batch });
      try {
        const res = await helixFetch(token, url);
        if (!res.ok) return { batch, streams: null };
        const data = await res.json();
        return { batch, streams: data.data || [] };
      } catch {
        return { batch, streams: null };
      }
    })
  );

  // 取得に失敗したバッチを「オフライン」に混ぜてはいけない。
  // 配信中かどうかが分からないだけなので unknown として分けて返す。
  const live = results.flatMap((r) => r.streams || []);
  const unknown = results.filter((r) => !r.streams).flatMap((r) => r.batch);
  const unknownSet = new Set(unknown.map(String));
  const liveIds = new Set(live.map((s) => String(s.user_id)));
  const offline = ids.filter((id) => !liveIds.has(String(id)) && !unknownSet.has(String(id)));

  return { live, offline, unknown, checked: ids.length };
}

// user_id[] → { user_id: profile_image_url }。100件ずつに割ってまとめて投げる。
// バッチ同士に依存関係はないので直列に待つ理由がない。
export async function fetchUserProfiles(token, userIds) {
  const batches = [];
  for (let i = 0; i < userIds.length; i += 100) batches.push(userIds.slice(i, i + 100));

  const pages = await Promise.all(
    batches.map(async (batch) => {
      const url = `${HELIX}/users?` + batch.map((id) => `id=${id}`).join('&');
      const res = await helixFetch(token, url);
      if (!res.ok) return [];
      const data = await res.json();
      return data.data || [];
    })
  );

  const profiles = {};
  pages.flat().forEach((u) => { profiles[u.id] = u.profile_image_url; });
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
