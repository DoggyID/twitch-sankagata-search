import { useEffect, useState } from 'react';
import { useGameSearch } from '../hooks/useGameSearch.js';

export function GameNameInput({ value, token, onSelect, onChange }) {
  const { setQuery, suggestions, loading } = useGameSearch(token);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    setQuery(value || '');
  }, [setQuery, value]);

  const showSuggestions = focused && suggestions.length > 0;

  const handleChange = (event) => {
    const text = event.target.value;
    setQuery(text);
    onChange(text);
  };

  const handleSelect = (category) => {
    setQuery(category.name);
    onSelect(category);
  };

  return (
    <div className="game-suggest">
      <input
        type="text"
        id="gameNameInput"
        value={value}
        onChange={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => window.setTimeout(() => setFocused(false), 120)}
        placeholder="例: Apex Legends"
        autoComplete="off"
      />
      {showSuggestions && (
        <div className="game-suggest-list">
          {suggestions.map((category) => (
            <button
              key={category.id}
              type="button"
              className="game-suggest-item"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => handleSelect(category)}
            >
              {category.name}
            </button>
          ))}
        </div>
      )}
      {focused && loading && <div className="game-suggest-loading">検索中...</div>}
    </div>
  );
}
