import { PLAYER_PARENT } from '../config.js';

export default function PreviewPanel({ stream, isFavorite, onToggleFavorite, onExclude, onVisited, onClose }) {
  if (!stream) {
    return (
      <aside className="preview-panel" aria-hidden="true">
        <div className="preview-empty">
          <p>配信カードをクリックすると、ここで配信を視聴できます。</p>
        </div>
      </aside>
    );
  }

  const login = stream.user_login;
  const src = `https://player.twitch.tv/?channel=${encodeURIComponent(login)}&parent=${encodeURIComponent(PLAYER_PARENT)}&muted=true&autoplay=true`;

  return (
    <aside className="preview-panel" aria-hidden="false">
      <div className="preview-content">
        <div className="preview-header">
          <div className="preview-title-block">
            <strong>{stream.user_name} ({login})</strong>
            <span className="preview-title">{stream.title || '(タイトルなし)'}</span>
          </div>
          <button type="button" className="preview-close" aria-label="プレビューを閉じる" onClick={onClose}>×</button>
        </div>
        <div className="preview-player-wrapper">
          <iframe
            key={login}
            src={src}
            allowFullScreen
            allow="autoplay; encrypted-media"
            title="Twitch live stream preview"
          />
        </div>
        <div className="preview-actions">
          <button type="button" className="preview-action-btn fav" onClick={onToggleFavorite}>
            {isFavorite ? '★ お気に入り解除' : '☆ お気に入りに追加'}
          </button>
          <button type="button" className="preview-action-btn exclude" onClick={onExclude}>🚫 除外</button>
          <button type="button" className="preview-action-btn visited" onClick={onVisited}>既視聴にする</button>
          <a
            href={`https://twitch.tv/${login}`}
            target="_blank"
            rel="noopener noreferrer"
            className="preview-action-btn open"
          >
            Twitchで開く ↗
          </a>
        </div>
      </div>
    </aside>
  );
}
