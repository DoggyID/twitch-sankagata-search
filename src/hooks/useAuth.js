import { useCallback, useEffect, useMemo, useState } from 'react';
import { CLIENT_ID, SCOPE } from '../config.js';

const TOKEN_KEY = 'twitchAccessToken';

// Twitch OAuth (implicit flow)。hash からトークンを取り出し、リダイレクトURIを動的算出。
// トークンは localStorage に保存し、別ページ（DPGK）と共有する
export function useAuth() {
  const [token, setTokenState] = useState(() => localStorage.getItem(TOKEN_KEY) || null);
  const [authError, setAuthError] = useState(null);

  const setToken = useCallback((value) => {
    setTokenState(value);
    if (value) localStorage.setItem(TOKEN_KEY, value);
    else localStorage.removeItem(TOKEN_KEY);
  }, []);

  const redirectUri = useMemo(() => {
    let uri = window.location.href.split('?')[0].split('#')[0];
    uri = uri.replace(/\/index\.html$/, '/');
    if (!uri.endsWith('/')) uri += '/';
    return uri;
  }, []);

  const authUrl = useMemo(
    () =>
      `https://id.twitch.tv/oauth2/authorize?client_id=${CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=token&scope=${encodeURIComponent(SCOPE)}`,
    [redirectUri]
  );

  useEffect(() => {
    if (!location.hash) return;
    const params = new URLSearchParams(location.hash.substring(1));
    const at = params.get('access_token');
    if (at) {
      setToken(at);
      history.replaceState(null, document.title, window.location.pathname + window.location.search);
    } else {
      const err = params.get('error_description');
      if (err) setAuthError(err);
    }
  }, []);

  return { token, authError, authUrl, redirectUri, setToken };
}
