import { useEffect, useState } from 'react';

// ダーク/ライトテーマ。既定はダーク（theme==='light' のときのみライト）
export function useTheme() {
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') !== 'light');

  useEffect(() => {
    document.documentElement.classList.toggle('dark-mode', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  return [isDark, setIsDark];
}
