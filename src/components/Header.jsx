export default function Header({ isDark, onToggleTheme }) {
  return (
    <div className="header-wrapper">
      <h1>
        <span className="brand-dot" aria-hidden="true" />
        Twitch ライブ配信検索
      </h1>
      <div className="theme-switch-wrapper">
        <span className="theme-switch-label">{isDark ? 'ダークモード' : 'ライトモード'}</span>
        <label className="theme-switch" htmlFor="theme-toggle">
          <input
            type="checkbox"
            id="theme-toggle"
            aria-label="ダークモードの切り替え"
            checked={isDark}
            onChange={(e) => onToggleTheme(e.target.checked)}
          />
          <span className="slider round" />
        </label>
      </div>
    </div>
  );
}
