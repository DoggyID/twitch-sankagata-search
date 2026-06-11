// Twitch アプリ設定（公開クライアントID前提・implicit flow）
export const CLIENT_ID = 'v4sb97ncaw1rbh8mizfg3ld7j5rkw2';
export const SCOPE = 'user:read:email';

export const PLACEHOLDER_PFP =
  'https://static-cdn.jtvnw.net/jtv_user_pictures/8a6381c7-d0c0-4576-b179-38bd5ce1d6af-profile_image-70x70.png';

// プレビュー/ザッピングの iframe parent（localhost / GitHub Pages 双方で動く）
export const PLAYER_PARENT = window.location.hostname || 'localhost';
