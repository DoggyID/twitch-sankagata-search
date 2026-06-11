import { useState } from 'react';
import StreamList from './StreamList.jsx';
import VisitedAccordion from './VisitedAccordion.jsx';

export default function Results({ favList, othersList, visited, isVisited, previewLogin, onSelect }) {
  const [tab, setTab] = useState('favorites');

  return (
    <div className="results-main">
      <div className="result-tabs">
        <button
          type="button"
          className={`result-tab${tab === 'favorites' ? ' active' : ''}`}
          onClick={() => setTab('favorites')}
        >
          ⭐ お気に入り ({favList.length})
        </button>
        <button
          type="button"
          className={`result-tab${tab === 'others' ? ' active' : ''}`}
          onClick={() => setTab('others')}
        >
          その他 ({othersList.length})
        </button>
      </div>

      <div className={`tab-panel${tab === 'favorites' ? '' : ' hidden'}`}>
        <StreamList
          streams={favList}
          emptyMsg="お気に入り登録された配信者は現在ライブ配信していません。"
          isVisited={isVisited}
          previewLogin={previewLogin}
          onSelect={onSelect}
        />
      </div>

      <div className={`tab-panel${tab === 'others' ? '' : ' hidden'}`}>
        <StreamList
          streams={othersList}
          emptyMsg="表示できる配信がありません。"
          isVisited={isVisited}
          previewLogin={previewLogin}
          onSelect={onSelect}
        />
        <VisitedAccordion visited={visited} />
      </div>
    </div>
  );
}
