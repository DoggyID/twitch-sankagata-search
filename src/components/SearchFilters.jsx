import { GameNameInput } from './GameNameInput.jsx';
import { LanguageSelect } from './LanguageSelect.jsx';

const LANGUAGES = [
  ['ja', '日本語 (Japanese)'],
  ['en', '英語 (English)'],
  ['ko', '韓国語 (Korean)'],
  ['zh', '中国語 (Chinese)'],
  ['es', 'スペイン語 (Spanish)'],
  ['fr', 'フランス語 (French)'],
  ['de', 'ドイツ語 (German)'],
  ['', 'すべての言語'],
];

export default function SearchFilters({ settings, onChange, onSearch, onReset, onChaos, onZap, searching, token }) {
  const set = (key) => (e) => onChange({ [key]: e.target.value });

  return (
    <>
      <div className="game-id-query-section">
        <h3>ゲームIDを名前で検索</h3>
        <GameNameInput
          value={settings.gameName}
          token={token}
          onSelect={(category) =>
            onChange({
              gameName: category.name,
              gameId: category.id,
              gameBoxArtUrl: category.box_art_url || '',
            })
          }
          onChange={(text) => onChange({ gameName: text, gameId: '' })}
        />
      </div>

      <div className="filter-options-wrapper">
        <h3>配信フィルターオプション</h3>
        <div className="filter-options-fields">
          <div className="filter-group title-filter">
            <label htmlFor="titleQueryInput">配信タイトルに含まれるキーワード (任意):</label>
            <input
              type="text"
              id="titleQueryInput"
              value={settings.titleQuery}
              onChange={set('titleQuery')}
              placeholder="例: 初心者, ランク"
            />
          </div>
          <div className="filter-group viewers-filter">
            <label htmlFor="maxViewersInput">最大視聴者数 (指定なしは全件):</label>
            <input
              type="number"
              id="maxViewersInput"
              value={settings.maxViewers}
              onChange={set('maxViewers')}
              placeholder="例: 100"
            />
          </div>
          <div className="filter-group language-filter">
            <label>言語:</label>
            <LanguageSelect
              languages={settings.languages || []}
              options={LANGUAGES.filter(([code]) => code !== '')}
              onChange={(next) => onChange({ languages: next })}
            />
          </div>
          <div className="filter-group tag-filter">
            <div className="label-with-toggle">
              <label htmlFor="tagInput">含めるタグ (カンマ区切り):</label>
              <div className="segmented-control" id="tagLogicControl">
                {['OR', 'AND'].map((logic) => (
                  <button
                    key={logic}
                    type="button"
                    className={`segmented-control-button${settings.tagLogic === logic ? ' active' : ''}`}
                    onClick={() => onChange({ tagLogic: logic })}
                  >
                    {logic}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="text"
              id="tagInput"
              value={settings.tagInput}
              onChange={set('tagInput')}
              placeholder="例: 協力プレイ,初見さん歓迎"
            />
          </div>
          <div className="filter-group tag-filter">
            <div className="label-with-toggle">
              <label htmlFor="excludeTagInput">除外タグ (カンマ区切り):</label>
            </div>
            <input
              type="text"
              id="excludeTagInput"
              value={settings.excludeTagInput}
              onChange={set('excludeTagInput')}
              placeholder="例: VTuber,大会"
            />
          </div>
          <div className="filter-group sort-order">
            <label htmlFor="sortOrderSelect">並び替え:</label>
            <select id="sortOrderSelect" value={settings.sortOrder} onChange={set('sortOrder')}>
              <option value="desc">視聴者数が多い順</option>
              <option value="asc">視聴者数が少ない順</option>
            </select>
          </div>
        </div>
      </div>

      <div className="button-group">
        <button className="primary-button" onClick={onSearch} disabled={searching}>
          {searching ? '検索中…' : '指定条件で配信を検索'}
        </button>
        <button className="secondary-button" onClick={onReset} title="閲覧済み履歴のみクリアします">
          リセット
        </button>
        {onChaos && <button className="chaos-button" onClick={onChaos} title="カオスモード">😺</button>}
        {onZap && <button className="zap-button" onClick={onZap} title="DPGKモード">⚡</button>}
      </div>
    </>
  );
}
