import { PLACEHOLDER_PFP } from '../config.js';

function StreamCard({ stream, visited, previewing, onClick }) {
  const thumbnailUrl = stream.thumbnail_url.replace('{width}', '640').replace('{height}', '360');
  return (
    <li
      className={`stream-item${visited ? ' visited' : ''}${previewing ? ' previewing' : ''}`}
      data-user={stream.user_login}
      onClick={onClick}
    >
      <div className="thumbnail-wrapper">
        <img src={thumbnailUrl} alt={`${stream.user_name} の配信サムネイル`} className="thumbnail" loading="lazy" />
        <span className="live-badge">LIVE</span>
        <span className="viewer-pill">👁 {stream.viewer_count.toLocaleString()}</span>
      </div>
      <div className="stream-info">
        <h3 className="stream-title">{stream.title || '(タイトルなし)'}</h3>
        <p className="streamer-line">
          <img src={stream.profile_image_url || PLACEHOLDER_PFP} alt="" className="streamer-pfp" />
          <strong>{stream.user_name}</strong>
          <span className="streamer-login">({stream.user_login})</span>
          {visited && <span className="visited-badge">視聴済</span>}
        </p>
        {stream.tags && stream.tags.length > 0 && (
          <div className="stream-tags">
            {stream.tags.map((tag) => (
              <span key={tag} className="stream-tag">{tag}</span>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

export default function StreamList({ streams, emptyMsg, isVisited, previewLogin, onSelect }) {
  if (!streams || streams.length === 0) {
    return <p className="empty-msg">{emptyMsg || '表示する配信はありません。'}</p>;
  }
  return (
    <ul className="stream-list">
      {streams.map((stream) => (
        <StreamCard
          key={stream.user_login}
          stream={stream}
          visited={isVisited(stream.user_login)}
          previewing={previewLogin === stream.user_login}
          onClick={() => onSelect(stream)}
        />
      ))}
    </ul>
  );
}
