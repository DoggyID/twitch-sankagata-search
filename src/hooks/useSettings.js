import { useCallback, useEffect, useState } from 'react';

const KEY = 'twitchSearchSettings';

const DEFAULTS = {
  gameName: 'Overwatch 2',
  titleQuery: '参加',
  maxViewers: '',
  language: 'ja',
  tagInput: '',
  excludeTagInput: '',
  sortOrder: 'desc',
  tagLogic: 'OR',
};

// 検索条件の保存/復元（変更のたびに localStorage へ反映）
export function useSettings() {
  const [settings, setSettings] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      return s ? { ...DEFAULTS, ...s } : { ...DEFAULTS };
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
