import { useState } from 'react';

function ChannelList({ logins, kind, nameCache, onRemove }) {
  if (logins.length === 0) {
    return (
      <ul className="channel-list">
        <li className="channel-list-empty">登録なし</li>
      </ul>
    );
  }
  return (
    <ul className="channel-list">
      {logins.map((login) => {
        const displayName = nameCache[login];
        const label = displayName ? `${displayName} (${login})` : login;
        return (
          <li key={login} data-login={login} data-kind={kind}>
            <span className="channel-list-name">{label}</span>
            <button
              type="button"
              className="remove-channel-btn"
              aria-label="削除"
              onClick={() => onRemove(login)}
            >
              ×
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export default function ChannelManagement({ channels, nameCache }) {
  const { favorites, excluded, addFavorite, removeFavorite, addExcluded, removeExcluded } = channels;
  const [favInput, setFavInput] = useState('');
  const [exInput, setExInput] = useState('');

  const submitFav = () => {
    if (!favInput.trim()) return;
    addFavorite(favInput);
    setFavInput('');
  };
  const submitEx = () => {
    if (!exInput.trim()) return;
    addExcluded(exInput);
    setExInput('');
  };

  return (
    <details className="channel-management">
      <summary>
        登録チャンネル管理 (お気に入り <span>{favorites.length}</span> / 除外 <span>{excluded.length}</span>)
      </summary>
      <div className="channel-mgmt-section">
        <h4>⭐ お気に入り</h4>
        <div className="channel-input-row">
          <input
            type="text"
            value={favInput}
            onChange={(e) => setFavInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitFav(); } }}
            placeholder="user_login を入力 (例: shroud)"
          />
          <button type="button" onClick={submitFav}>追加</button>
        </div>
        <ChannelList logins={favorites} kind="fav" nameCache={nameCache} onRemove={removeFavorite} />
      </div>
      <div className="channel-mgmt-section">
        <h4>🚫 検索除外</h4>
        <div className="channel-input-row">
          <input
            type="text"
            value={exInput}
            onChange={(e) => setExInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitEx(); } }}
            placeholder="user_login を入力"
          />
          <button type="button" onClick={submitEx}>追加</button>
        </div>
        <ChannelList logins={excluded} kind="ex" nameCache={nameCache} onRemove={removeExcluded} />
      </div>
    </details>
  );
}
