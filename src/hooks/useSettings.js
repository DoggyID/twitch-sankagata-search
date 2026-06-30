import { useCallback, useEffect, useState } from 'react';

const KEY = 'twitchSearchSettings';

const DEFAULTS = {
  gameId: '',
  gameBoxArtUrl: '',
  gameName: 'Overwatch 2',
  titleQuery: '参加',
  maxViewers: '',
  languages: ['ja'],
  tagInput: '',
  excludeTagInput: '',
  sortOrder: 'desc',
  tagLogic: 'OR',
};

// 検索条件の保存/復元（変更のたびに localStorage へ反映）。
// 旧形式 { language: 'ja' }（文字列）が残っている場合は { languages: ['ja'] }（配列）へ変換する。
function normalizeSettings(saved) {
  const normalized = { ...DEFAULTS, ...saved };
  if (typeof saved?.language === 'string' && !Array.isArray(saved.languages)) {
    normalized.languages = saved.language === '' ? [] : [saved.language];
  }
  if (!Array.isArray(normalized.languages)) normalized.languages = DEFAULTS.languages;
  delete normalized.language;
  return normalized;
}

export function useSettings() {
  const [settings, setSettings] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      return s ? normalizeSettings(s) : { ...DEFAULTS };
    } catch {
      return { ...DEFAULTS };
    }
  });

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(settings));
  }, [settings]);

  const update = useCallback((patch) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  return [settings, update];
}
