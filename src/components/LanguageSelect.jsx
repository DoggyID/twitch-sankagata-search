import { useEffect, useRef, useState } from 'react';

// 言語の複数選択UI。省スペースのため、普段はボタン1個（選択中の言語を要約表示）に畳んでおき、
// クリックでチェックボックス一覧を開く。外側クリックで閉じる。
export function LanguageSelect({ languages, options, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handleOutside = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const toggle = (code, checked) => {
    const next = checked ? [...languages, code] : languages.filter((l) => l !== code);
    onChange(next);
  };

  const summary = languages.length === 0
    ? 'すべての言語'
    : options
        .filter(([code]) => languages.includes(code))
        .map(([, label]) => label.split(' ')[0])
        .join(', ');

  return (
    <div className="language-select" ref={rootRef}>
      <button
        type="button"
        className="language-select-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="language-select-summary">{summary}</span>
        <span className="language-select-caret">▾</span>
      </button>
      {open && (
        <div className="language-select-panel">
          {options.map(([code, label]) => (
            <label key={code} className="language-option">
              <input
                type="checkbox"
                checked={languages.includes(code)}
                onChange={(e) => toggle(code, e.target.checked)}
              />
              <span>{label}</span>
            </label>
          ))}
          {languages.length === 0 && (
            <p className="language-note">未選択の場合はすべての言語が対象になります</p>
          )}
        </div>
      )}
    </div>
  );
}
