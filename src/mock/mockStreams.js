// デモモード用のサンプル配信データ（認証なしで UI / ザッピングを確認するため）
const TAGS = [
  ['日本語', '初見さん歓迎', '参加型'],
  ['ランク', 'ガチ', 'コーチング'],
  ['まったり', '雑談', '初心者'],
  ['協力プレイ', 'フルパ', '大会'],
  ['English', 'Speedrun'],
  ['VTuber', '歌枠'],
];

function pic(seed, w, h) {
  return `https://picsum.photos/seed/${seed}/${w}/${h}`;
}

export const MOCK_STREAMS = Array.from({ length: 14 }, (_, i) => {
  const n = i + 1;
  return {
    id: `mock-${n}`,
    user_id: `${1000 + n}`,
    user_login: `demo_streamer_${n}`,
    user_name: `デモ配信者${n}`,
    game_id: '515025',
    game_name: 'Overwatch 2',
    type: 'live',
    title: `【参加型】デモ配信タイトル ${n} - みんなで遊ぼう！`,
    viewer_count: Math.floor((Math.sin(n) * 0.5 + 0.5) * 4800) + 12,
    started_at: '2026-06-12T08:00:00Z',
    language: 'ja',
    // {width}/{height} プレースホルダは本体ロジックが置換する
    thumbnail_url: `https://picsum.photos/seed/thumb${n}/{width}/{height}`,
    profile_image_url: pic(`pfp${n}`, 70, 70),
    tags: TAGS[i % TAGS.length],
    tag_ids: [],
    is_mature: false,
  };
});
