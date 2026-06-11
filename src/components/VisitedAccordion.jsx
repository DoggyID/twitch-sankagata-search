export default function VisitedAccordion({ visited }) {
  if (!visited || visited.length === 0) return null;
  return (
    <div className="visited-streams-container">
      <details className="visited-accordion">
        <summary>閲覧済みの配信 (<span>{visited.length}</span>)</summary>
        <ul className="visited-list">
          {visited.map((s) => (
            <li key={s.user_login} className="visited-item">
              <img src={s.thumbnail_url.replace('{width}', '40').replace('{height}', '22')} alt="" />
              <div className="visited-info">
                <span className="visited-badge">視聴済</span>
                <a href={`https://twitch.tv/${s.user_login}`} target="_blank" rel="noopener noreferrer">
                  {s.title || '(タイトルなし)'}
                </a>
              </div>
              <div className="visited-meta">{s.user_name}</div>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
