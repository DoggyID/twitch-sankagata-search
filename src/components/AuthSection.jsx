export default function AuthSection({ authUrl, authError, onDemo }) {
  return (
    <div id="authSection" className="auth-section">
      <a id="authLink" className="auth-link" href={authUrl}>Twitch認証</a>
      <p id="authStatus" className={authError ? 'error' : ''}>
        {authError ? `認証に失敗しました: ${authError}` : 'Twitchアカウントで認証してください。'}
      </p>
      <button type="button" className="demo-button" onClick={onDemo}>
        🎬 デモモードで表示を確認（認証不要）
      </button>
    </div>
  );
}
