// --- 設定値 ---
const clientId = 'v4sb97ncaw1rbh8mizfg3ld7j5rkw2'; // Make sure this matches your Twitch Console Client ID
const scope = 'user:read:email';

let currentAccessToken = null;

// --- DOM要素 (Script assumed to be at end of body) ---
const authLink = document.getElementById('authLink');
const authStatus = document.getElementById('authStatus');
const authSection = document.getElementById('authSection');
const searchSection = document.getElementById('searchSection');
const favoritesResultDiv = document.getElementById('favoritesResult');
const othersResultDiv = document.getElementById('othersResult');
const searchStatusDiv = document.getElementById('searchStatus');
const favCountUI = document.getElementById('favCount');
const othersCountUI = document.getElementById('othersCount');
const gameIdInput = document.getElementById('gameIdInput');
const gameNameInput = document.getElementById('gameNameInput');
const gameIdQueryResultDiv = document.getElementById('gameIdQueryResult');
const maxViewersInput = document.getElementById('maxViewersInput');
const titleQueryInput = document.getElementById('titleQueryInput');
const languageSelect = document.getElementById('languageSelect');
const tagInput = document.getElementById('tagInput');
const excludeTagInput = document.getElementById('excludeTagInput');
const sortOrderSelect = document.getElementById('sortOrderSelect');
const visitedListUI = document.getElementById('visitedList');
const visitedCountUI = document.getElementById('visitedCount');
const visitedContainer = document.getElementById('visitedContainer');

// --- Dark Mode Elements ---
const themeToggle = document.getElementById('theme-toggle');
const themeLabel = document.getElementById('theme-label-text');

let visitedStreams = []; // Track clicked streams
let favoriteChannels = []; // user_login[] (lowercased)
let excludedChannels = []; // user_login[] (lowercased)
const channelNameCache = {}; // user_login -> user_name (last seen)

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("Initializing application...");

    // 1. Generate Redirect URI dynamically
    // Ensure we are redirecting to the directory root or the specific file as registered in Twitch
    let redirectUri = window.location.href.split('?')[0].split('#')[0];
    redirectUri = redirectUri.replace(/\/index\.html$/, '/');
    if (!redirectUri.endsWith('/')) {
        redirectUri += '/';
    }
    console.log("Detected Redirect URI:", redirectUri);

    // 2. Set Auth Link URL
    if (authLink) {
        const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(scope)}`;
        console.log("Generated Auth URL:", authUrl);
        authLink.href = authUrl;
    } else {
        console.error("Error: authLink element not found during initialization.");
    }

    // 3. Check for Access Token in Hash
    if (location.hash) {
        console.log("Hash found:", location.hash);
        const fragmentParams = new URLSearchParams(location.hash.substring(1));
        const accessToken = fragmentParams.get('access_token');

        if (accessToken) {
            currentAccessToken = accessToken;
            console.log("Access Token acquired.");
            authStatus.textContent = '認証成功！ゲーム名とフィルター条件を入力して配信を検索できます。';
            authStatus.style.color = 'green';
            authSection.style.display = 'none';
            searchSection.style.display = 'block';

            // Clean URL
            history.replaceState(null, document.title, window.location.pathname + window.location.search);
        } else {
            const error = fragmentParams.get('error_description');
            if (error) {
                console.error("Auth Error:", error);
                authStatus.textContent = `認証に失敗しました: ${error}`;
                authStatus.style.color = 'red';
            }
        }
    }

    // 4. Setup Theme (Dark Mode)
    const savedTheme = localStorage.getItem('theme');
    // Default to Dark Mode unless explicitly 'light'
    if (savedTheme === 'light') {
        setDarkMode(false);
    } else {
        setDarkMode(true);
    }

    if (themeToggle) {
        themeToggle.addEventListener('change', () => {
            setDarkMode(themeToggle.checked);
        });
    }

    // 5. Setup Segmented Control Logic
    const tagLogicControl = document.getElementById('tagLogicControl');
    if (tagLogicControl) {
        tagLogicControl.addEventListener('click', (e) => {
            if (e.target.matches('.segmented-control-button')) {
                tagLogicControl.querySelectorAll('.segmented-control-button').forEach(btn => {
                    btn.classList.remove('active');
                });
                e.target.classList.add('active');
            }
        });
    }

    // 6. Load saved settings
    loadSettings();
    loadVisitedStreams();
    loadChannelLists();
    renderChannelLists();
    setupTabs();
    setupChannelMgmt();
});


// --- Helper Functions ---

function setDarkMode(isDark) {
    if (themeToggle && themeLabel) {
        if (isDark) {
            document.documentElement.classList.add('dark-mode');
            themeToggle.checked = true;
            themeLabel.textContent = 'ダークモード';
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark-mode');
            themeToggle.checked = false;
            themeLabel.textContent = 'ライトモード';
            localStorage.setItem('theme', 'light');
        }
    }
}

// --- Visited Streams Management ---
function loadVisitedStreams() {
    const saved = localStorage.getItem('twitchVisitedStreams');
    if (saved) {
        visitedStreams = JSON.parse(saved);
        updateVisitedUI();
    }
}

function saveVisitedStreams() {
    localStorage.setItem('twitchVisitedStreams', JSON.stringify(visitedStreams));
}

function addVisitedStream(stream) {
    if (!visitedStreams.some(s => s.user_login === stream.user_login)) {
        visitedStreams.unshift({
            user_login: stream.user_login,
            user_name: stream.user_name,
            title: stream.title,
            thumbnail_url: stream.thumbnail_url,
            viewed_at: new Date().toISOString()
        });
        if (visitedStreams.length > 50) visitedStreams.pop();
        saveVisitedStreams();
        updateVisitedUI();
    }
}

function updateVisitedUI() {
    if (!visitedListUI || !visitedContainer || !visitedCountUI) return;

    if (visitedStreams.length > 0) {
        visitedContainer.style.display = 'block';
        visitedCountUI.textContent = visitedStreams.length;

        visitedListUI.innerHTML = visitedStreams.map(s => `
            <li class="visited-item">
                <img src="${s.thumbnail_url.replace('{width}', '40').replace('{height}', '22')}" alt="">
                <div class="visited-info">
                    <span class="visited-badge">視聴済</span>
                    <a href="https://twitch.tv/${s.user_login}" target="_blank" rel="noopener noreferrer">${s.title || '(タイトルなし)'}</a>
                </div>
                <div class="visited-meta">${s.user_name}</div>
            </li>
        `).join('');
    } else {
        visitedContainer.style.display = 'none';
    }
}

function handleStreamClick(stream) {
    addVisitedStream(stream);
    const item = document.querySelector(`.stream-item[data-user="${stream.user_login}"]`);
    if (item) {
        item.style.display = 'none';
    }
}

// --- Favorite / Excluded Channels Management ---
function normalizeLogin(login) {
    return (login || '').trim().toLowerCase();
}

function loadChannelLists() {
    try {
        const fav = localStorage.getItem('twitchFavoriteChannels');
        if (fav) favoriteChannels = JSON.parse(fav).map(normalizeLogin).filter(Boolean);
    } catch (e) { favoriteChannels = []; }
    try {
        const ex = localStorage.getItem('twitchExcludedChannels');
        if (ex) excludedChannels = JSON.parse(ex).map(normalizeLogin).filter(Boolean);
    } catch (e) { excludedChannels = []; }
}

function saveFavorites() {
    localStorage.setItem('twitchFavoriteChannels', JSON.stringify(favoriteChannels));
}

function saveExcluded() {
    localStorage.setItem('twitchExcludedChannels', JSON.stringify(excludedChannels));
}

function isFavorite(login) {
    return favoriteChannels.includes(normalizeLogin(login));
}

function isExcluded(login) {
    return excludedChannels.includes(normalizeLogin(login));
}

function addFavorite(login) {
    const n = normalizeLogin(login);
    if (!n) return false;
    // Mutual exclusion with excluded list
    const exIdx = excludedChannels.indexOf(n);
    if (exIdx !== -1) {
        excludedChannels.splice(exIdx, 1);
        saveExcluded();
    }
    if (!favoriteChannels.includes(n)) {
        favoriteChannels.push(n);
        saveFavorites();
        return true;
    }
    return false;
}

function removeFavorite(login) {
    const n = normalizeLogin(login);
    const idx = favoriteChannels.indexOf(n);
    if (idx !== -1) {
        favoriteChannels.splice(idx, 1);
        saveFavorites();
        return true;
    }
    return false;
}

function addExcluded(login) {
    const n = normalizeLogin(login);
    if (!n) return false;
    const favIdx = favoriteChannels.indexOf(n);
    if (favIdx !== -1) {
        favoriteChannels.splice(favIdx, 1);
        saveFavorites();
    }
    if (!excludedChannels.includes(n)) {
        excludedChannels.push(n);
        saveExcluded();
        return true;
    }
    return false;
}

function removeExcluded(login) {
    const n = normalizeLogin(login);
    const idx = excludedChannels.indexOf(n);
    if (idx !== -1) {
        excludedChannels.splice(idx, 1);
        saveExcluded();
        return true;
    }
    return false;
}

function renderChannelLists() {
    const favListUI = document.getElementById('favoriteList');
    const exListUI = document.getElementById('excludeList');
    const favListCountUI = document.getElementById('favListCount');
    const exListCountUI = document.getElementById('exListCount');

    if (favListCountUI) favListCountUI.textContent = favoriteChannels.length;
    if (exListCountUI) exListCountUI.textContent = excludedChannels.length;

    const buildItem = (login, kind) => {
        const displayName = channelNameCache[login];
        const label = displayName ? `${displayName} (${login})` : login;
        return `<li data-login="${login}" data-kind="${kind}">
            <span class="channel-list-name">${label}</span>
            <button type="button" class="remove-channel-btn" aria-label="削除">×</button>
        </li>`;
    };

    if (favListUI) {
        favListUI.innerHTML = favoriteChannels.length
            ? favoriteChannels.map(l => buildItem(l, 'fav')).join('')
            : '<li class="channel-list-empty">登録なし</li>';
    }
    if (exListUI) {
        exListUI.innerHTML = excludedChannels.length
            ? excludedChannels.map(l => buildItem(l, 'ex')).join('')
            : '<li class="channel-list-empty">登録なし</li>';
    }

    [favListUI, exListUI].forEach(ul => {
        if (!ul) return;
        ul.querySelectorAll('.remove-channel-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const li = btn.closest('li');
                if (!li) return;
                const login = li.dataset.login;
                const kind = li.dataset.kind;
                if (kind === 'fav') removeFavorite(login);
                else removeExcluded(login);
                renderChannelLists();
                if (currentFilteredStreams.length > 0) renderResults(currentFilteredStreams);
            });
        });
    });
}

function setupChannelMgmt() {
    const favInput = document.getElementById('favoriteInput');
    const exInput = document.getElementById('excludeInput');
    const addFavBtn = document.getElementById('addFavoriteBtn');
    const addExBtn = document.getElementById('addExcludeBtn');

    const handleAdd = (input, addFn) => {
        if (!input) return;
        const val = input.value;
        if (!val.trim()) return;
        addFn(val);
        input.value = '';
        renderChannelLists();
        if (currentFilteredStreams.length > 0) renderResults(currentFilteredStreams);
    };

    if (addFavBtn) addFavBtn.addEventListener('click', () => handleAdd(favInput, addFavorite));
    if (addExBtn) addExBtn.addEventListener('click', () => handleAdd(exInput, addExcluded));
    if (favInput) favInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); handleAdd(favInput, addFavorite); }
    });
    if (exInput) exInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); handleAdd(exInput, addExcluded); }
    });
}

// --- Tabs ---
function setupTabs() {
    const tabsContainer = document.getElementById('resultTabs');
    if (!tabsContainer) return;
    tabsContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.result-tab');
        if (!btn) return;
        const tabKey = btn.dataset.tab;
        tabsContainer.querySelectorAll('.result-tab').forEach(b => b.classList.toggle('active', b === btn));
        document.querySelectorAll('.tab-panel').forEach(panel => {
            panel.classList.toggle('hidden', panel.id !== `tab-${tabKey}`);
        });
    });
}

// --- Settings Management ---
function saveSettings() {
    if (!gameNameInput) return;
    const settings = {
        gameName: gameNameInput.value,
        titleQuery: titleQueryInput ? titleQueryInput.value : '',
        maxViewers: maxViewersInput ? maxViewersInput.value : '',
        language: languageSelect ? languageSelect.value : 'ja',
        tagInput: tagInput ? tagInput.value : '',
        excludeTagInput: excludeTagInput ? excludeTagInput.value : '',
        sortOrder: sortOrderSelect ? sortOrderSelect.value : 'desc',
    };

    const tagBtn = document.querySelector('#tagLogicControl .segmented-control-button.active');
    if (tagBtn) {
        settings.tagLogic = tagBtn.dataset.logic;
    }

    localStorage.setItem('twitchSearchSettings', JSON.stringify(settings));
}

function loadSettings() {
    const saved = localStorage.getItem('twitchSearchSettings');
    if (saved) {
        try {
            const settings = JSON.parse(saved);
            if (gameNameInput) gameNameInput.value = settings.gameName || 'Overwatch 2';
            if (titleQueryInput) titleQueryInput.value = settings.titleQuery || '参加';
            if (maxViewersInput) maxViewersInput.value = settings.maxViewers || '';
            if (languageSelect) languageSelect.value = settings.language || 'ja';
            if (tagInput) tagInput.value = settings.tagInput || '';
            if (excludeTagInput) excludeTagInput.value = settings.excludeTagInput || '';
            if (sortOrderSelect) sortOrderSelect.value = settings.sortOrder || 'desc';

            if (settings.tagLogic) {
                const tagLogicControl = document.getElementById('tagLogicControl');
                if (tagLogicControl) {
                    tagLogicControl.querySelectorAll('.segmented-control-button').forEach(btn => {
                        if (btn.dataset.logic === settings.tagLogic) {
                            btn.classList.add('active');
                        } else {
                            btn.classList.remove('active');
                        }
                    });
                }
            }
        } catch (e) {
            console.error("Error loading settings:", e);
        }
    }
}

// --- Reset Settings ---
const resetSettingsBtn = document.getElementById('resetSettingsBtn');
if (resetSettingsBtn) {
    resetSettingsBtn.addEventListener('click', resetSettings);
}

function resetSettings() {
    if (!confirm('既視聴履歴をクリアしますか？\n(検索条件・お気に入り・除外リストは保持されます)')) {
        return;
    }
    localStorage.removeItem('twitchVisitedStreams');
    visitedStreams = [];
    updateVisitedUI();
    if (currentFilteredStreams.length > 0) {
        renderResults(currentFilteredStreams);
    }
}

// --- Game ID & Stream Search ---
async function handleGameIdAndStreamSearch() {
    saveSettings();
    if (!gameNameInput) return;
    const gameNameToSearch = gameNameInput.value.trim();
    if (gameNameToSearch) {
        const gameFound = await getGameIdByName(gameNameToSearch);
        if (gameFound) {
            searchLiveStreams();
        } else {
            setSearchStatus('<p class="error">指定されたゲーム名が見つからなかったため、配信を検索できません。</p>');
        }
    } else {
        gameIdQueryResultDiv.innerHTML = '<p class="error">検索するゲーム名を入力してください。</p>';
        setSearchStatus('');
    }
}

// --- Get Game ID ---
async function getGameIdByName(gameName) {
    if (!currentAccessToken) {
        gameIdQueryResultDiv.innerHTML = '<p class="error">エラー: Twitch認証が完了していません。</p>';
        return false;
    }

    gameIdQueryResultDiv.innerHTML = `<p>「${gameName}」のIDを検索中...</p>`;
    setSearchStatus('');
    const gameApiUrl = `https://api.twitch.tv/helix/games?name=${encodeURIComponent(gameName)}`;

    try {
        const response = await fetch(gameApiUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${currentAccessToken}`,
                'Client-ID': clientId
            }
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${data.message || 'ゲーム情報の取得に失敗しました。'}`);
        }

        if (data.data && data.data.length > 0) {
            const game = data.data[0];
            gameIdQueryResultDiv.innerHTML = `
                <p><strong>「${game.name}」</strong> (ID: <strong>${game.id}</strong>) が見つかりました。</p>
                <p><img src="${game.box_art_url.replace('{width}x{height}', '52x72')}" alt="${game.name} のボックスアート"></p>
            `;
            if (gameIdInput) gameIdInput.value = game.id;
            return true;
        } else {
            gameIdQueryResultDiv.innerHTML = `<p>「${gameName}」という名前のゲームは見つかりませんでした。</p>`;
            if (gameIdInput) gameIdInput.value = '';
            return false;
        }
    } catch (error) {
        console.error('APIリクエストエラー (ゲームID検索):', error);
        gameIdQueryResultDiv.innerHTML = `<p class="error">ゲームID検索中にエラーが発生しました:<br>${error.message}</p>`;
        if (gameIdInput) gameIdInput.value = '';
        return false;
    }
}

// --- Search Live Streams ---
async function searchLiveStreams() {
    if (!currentAccessToken) {
        setSearchStatus('<p class="error">エラー: Twitch認証が完了していません。</p>');
        return;
    }

    if (!gameIdInput) return;
    const gameId = gameIdInput.value.trim();
    if (!gameId) return;

    const maxViewers = parseInt(maxViewersInput.value.trim(), 10);
    const titleQuery = titleQueryInput.value.trim().toLowerCase();
    const selectedLanguage = languageSelect.value;
    const tagQueries = tagInput.value.split(',').map(t => t.trim().toLowerCase()).filter(t => t);
    const excludeTagQueries = excludeTagInput.value.split(',').map(t => t.trim().toLowerCase()).filter(t => t);
    const activeLogicButton = document.querySelector('#tagLogicControl .segmented-control-button.active');
    const tagLogic = activeLogicButton ? activeLogicButton.dataset.logic : 'OR';

    let searchMessage = `ゲームID「${gameId}」、言語「${selectedLanguage ? languageSelect.options[languageSelect.selectedIndex].text : 'すべての言語'}」`;
    if (tagQueries.length > 0) searchMessage += `、タグに「${tagInput.value.trim()}」を(${tagLogic}条件で)含む`;
    if (excludeTagQueries.length > 0) searchMessage += `、除外タグ「${excludeTagInput.value.trim()}」`;
    if (titleQuery) searchMessage += `、タイトルに「${titleQueryInput.value.trim()}」を含む`;
    if (!isNaN(maxViewers)) searchMessage += `、最大視聴者数「${maxViewers}」`;
    searchMessage += `で配信を検索中...`;
    setSearchStatus(`<p>${searchMessage}</p>`);

    let allStreams = [];
    let cursor = null;
    let page = 1;

    try {
        do {
            if (page > 1) {
                setSearchStatus(`<p>${searchMessage} (現在${allStreams.length}件取得済み、次のページを検索中...)</p>`);
            }

            let streamsApiUrl = `https://api.twitch.tv/helix/streams?game_id=${encodeURIComponent(gameId)}&first=100`;
            if (selectedLanguage) streamsApiUrl += `&language=${selectedLanguage}`;
            if (cursor) streamsApiUrl += `&after=${cursor}`;

            const response = await fetch(streamsApiUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${currentAccessToken}`,
                    'Client-ID': clientId
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Error ${response.status}: ${errorData.message || 'ストリーム情報の取得に失敗しました。'}`);
            }

            const data = await response.json();

            if (data.data && data.data.length > 0) {
                allStreams.push(...data.data);
            }

            cursor = data.pagination.cursor;
            if (cursor) await new Promise(resolve => setTimeout(resolve, 300));
            page++;

        } while (cursor);

        // Client-side filtering
        let streamsToDisplay = allStreams;
        if (titleQuery) {
            streamsToDisplay = streamsToDisplay.filter(stream => stream.title && stream.title.toLowerCase().includes(titleQuery));
        }
        if (tagQueries.length > 0) {
            streamsToDisplay = streamsToDisplay.filter(stream => {
                if (!stream.tags || stream.tags.length === 0) return false;
                const streamTagsLower = stream.tags.map(t => t.toLowerCase());
                if (tagLogic === 'AND') {
                    return tagQueries.every(queryTag => streamTagsLower.includes(queryTag));
                } else {
                    return tagQueries.some(queryTag => streamTagsLower.includes(queryTag));
                }
            });
        }
        if (excludeTagQueries.length > 0) {
            streamsToDisplay = streamsToDisplay.filter(stream => {
                if (!stream.tags || stream.tags.length === 0) return true;
                const streamTagsLower = stream.tags.map(t => t.toLowerCase());
                return !excludeTagQueries.some(excludedTag => streamTagsLower.includes(excludedTag));
            });
        }
        if (!isNaN(maxViewers) && maxViewers >= 0) {
            streamsToDisplay = streamsToDisplay.filter(stream => stream.viewer_count <= maxViewers);
        }

        currentFilteredStreams = streamsToDisplay;
        sortStreams(false); // Sort and display (false = don't redisplay inside sortStreams immediately, but here we handle display)

        // Wait, sortStreams calls displayStreams. Let's make sure we handle filtered streams fetching profile pics.
        // Actually, just calling sortStreams() is not enough because we need PFP fetching.

        // Refined Logic for PFP Fetching:
        const sortOrder = sortOrderSelect.value;
        if (sortOrder === 'asc') {
            currentFilteredStreams.sort((a, b) => a.viewer_count - b.viewer_count);
        } else {
            currentFilteredStreams.sort((a, b) => b.viewer_count - a.viewer_count);
        }

        if (currentFilteredStreams.length > 0) {
            setSearchStatus(`<p>${currentFilteredStreams.length}件の配信が見つかりました。配信者のアイコンを取得中... (並び替え: ${sortOrder === 'asc' ? '視聴者数が少ない順' : '視聴者数が多い順'})</p>`);
            const userIds = [...new Set(currentFilteredStreams.map(s => s.user_id))];
            const userProfiles = {};

            for (let i = 0; i < userIds.length; i += 100) {
                const batch = userIds.slice(i, i + 100);
                let userApiUrl = 'https://api.twitch.tv/helix/users?';
                userApiUrl += batch.map(id => `id=${id}`).join('&');

                const userResponse = await fetch(userApiUrl, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${currentAccessToken}`, 'Client-ID': clientId }
                });
                const userData = await userResponse.json();
                if (userData.data) {
                    userData.data.forEach(user => { userProfiles[user.id] = user.profile_image_url; });
                }
                await new Promise(resolve => setTimeout(resolve, 300));
            }

            currentFilteredStreams.forEach(stream => {
                stream.profile_image_url = userProfiles[stream.user_id];
            });

            setSearchStatus(`<p class="result-count">${currentFilteredStreams.length}件の配信が見つかりました。</p>`);
            renderResults(currentFilteredStreams);
        } else {
            setSearchStatus(`<p class="result-count">0件の配信が見つかりました。</p><p>指定された条件に一致するライブ配信は見つかりませんでした。</p>`);
            renderResults([]);
        }

    } catch (error) {
        console.error('APIリクエストエラー (ストリーム検索):', error);
        setSearchStatus(`<p class="error">ライブ配信検索中にエラーが発生しました:<br>${error.message}</p>`);
    }
}

function setSearchStatus(html) {
    if (searchStatusDiv) searchStatusDiv.innerHTML = html;
}

// --- Sorting ---
let currentFilteredStreams = [];

function sortStreams(andDisplay = true) {
    if (!sortOrderSelect) return;
    const sortOrder = sortOrderSelect.value;
    if (sortOrder === 'asc') {
        currentFilteredStreams.sort((a, b) => a.viewer_count - b.viewer_count);
    } else {
        currentFilteredStreams.sort((a, b) => b.viewer_count - a.viewer_count);
    }
    if (andDisplay && currentFilteredStreams.length > 0) {
        renderResults(currentFilteredStreams);
    }
}

sortOrderSelect.addEventListener('change', () => {
    if (currentFilteredStreams.length > 0) {
        sortStreams(true);
    }
});

function renderResults(streams) {
    // Cache display names for management UI
    streams.forEach(s => {
        const n = normalizeLogin(s.user_login);
        if (n) channelNameCache[n] = s.user_name;
    });

    const favList = [];
    const othersList = [];
    streams.forEach(stream => {
        const login = normalizeLogin(stream.user_login);
        if (isExcluded(login)) return;
        if (isFavorite(login)) favList.push(stream);
        else othersList.push(stream);
    });

    // Visited filtering: only hide from "others" tab
    const othersVisible = othersList.filter(s => !visitedStreams.some(v => v.user_login === s.user_login));

    if (favCountUI) favCountUI.textContent = favList.length;
    if (othersCountUI) othersCountUI.textContent = othersVisible.length;

    renderStreamList(favoritesResultDiv, favList, {
        emptyMsg: '<p>お気に入り登録された配信者は現在ライブ配信していません。</p>'
    });
    renderStreamList(othersResultDiv, othersVisible, {
        emptyMsg: '<p>表示できる配信がありません。</p>'
    });

    // Update the management list display names now that cache is populated
    renderChannelLists();
}

function renderStreamList(targetDiv, streams, opts = {}) {
    if (!targetDiv) return;

    if (!streams || streams.length === 0) {
        targetDiv.innerHTML = opts.emptyMsg || '<p>表示する配信はありません。</p>';
        return;
    }

    const placeholderPfp = 'https://static-cdn.jtvnw.net/jtv_user_pictures/8a6381c7-d0c0-4576-b179-38bd5ce1d6af-profile_image-70x70.png';
    let htmlContent = '<ul class="stream-list">';
    streams.forEach(stream => {
        const thumbnailUrl = stream.thumbnail_url.replace('{width}', '640').replace('{height}', '360');
        const login = normalizeLogin(stream.user_login);
        const favBtnLabel = isFavorite(login) ? '★ お気に入り解除' : '☆ お気に入り';
        const visited = visitedStreams.some(v => v.user_login === stream.user_login);

        htmlContent += `
            <li class="stream-item${visited ? ' visited' : ''}" data-user="${stream.user_login}">
                <div class="thumbnail-wrapper">
                    <img src="${thumbnailUrl}" alt="${stream.user_name} の配信サムネイル" class="thumbnail">
                </div>
                <div class="stream-info">
                    <h3><a href="https://twitch.tv/${stream.user_login}" target="_blank" rel="noopener noreferrer">${stream.title || '(タイトルなし)'}</a></h3>
                    <p>
                        <img src="${stream.profile_image_url || placeholderPfp}" alt="" class="streamer-pfp">
                        配信者: <strong>${stream.user_name} (${stream.user_login})</strong>
                    </p>
                    <p>視聴者数: <strong>${stream.viewer_count.toLocaleString()}</strong> 人${visited ? ' <span class="visited-badge">視聴済</span>' : ''}</p>
                </div>
                <div class="stream-actions">
                    <button type="button" class="toggle-fav-btn">${favBtnLabel}</button>
                    <button type="button" class="exclude-btn">🚫 除外</button>
                    <button type="button" class="mark-visited-btn">既視聴にする</button>
                </div>
            </li>
        `;
    });
    htmlContent += '</ul>';
    targetDiv.innerHTML = htmlContent;

    const streamMap = new Map(streams.map(s => [s.user_login, s]));
    targetDiv.querySelectorAll('.stream-item').forEach(item => {
        const userLogin = item.dataset.user;
        const stream = streamMap.get(userLogin);
        if (!stream) return;

        item.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => handleStreamClick(stream));
        });

        const markVisitedBtn = item.querySelector('.mark-visited-btn');
        if (markVisitedBtn) {
            markVisitedBtn.addEventListener('click', () => handleStreamClick(stream));
        }

        const favBtn = item.querySelector('.toggle-fav-btn');
        if (favBtn) {
            favBtn.addEventListener('click', () => {
                if (isFavorite(stream.user_login)) removeFavorite(stream.user_login);
                else addFavorite(stream.user_login);
                renderChannelLists();
                if (currentFilteredStreams.length > 0) renderResults(currentFilteredStreams);
            });
        }

        const excludeBtn = item.querySelector('.exclude-btn');
        if (excludeBtn) {
            excludeBtn.addEventListener('click', () => {
                if (!confirm(`「${stream.user_name}」を検索除外に追加しますか？`)) return;
                addExcluded(stream.user_login);
                renderChannelLists();
                if (currentFilteredStreams.length > 0) renderResults(currentFilteredStreams);
            });
        }
    });
}

// --- CHAOS MODE ---
document.addEventListener('DOMContentLoaded', () => {
    const chaosBtn = document.getElementById('chaosBtn');
    if (chaosBtn) {
        chaosBtn.addEventListener('click', activateChaos);
    }
});

function activateChaos() {
    // 激しい変色と明滅 (Intense Color Change & Flickering)
    setInterval(() => {
        const hue = Math.floor(Math.random() * 360);
        // Flickering: Randomly switch between dark and bright to simulate "Dark Mode" flickering
        // 10% (Very Dark/Black), 50% (Vibrant), 90% (White/Flash)
        const rand = Math.random();
        let lightness;
        if (rand < 0.3) lightness = 10; // Dark
        else if (rand < 0.6) lightness = 90; // Flash
        else lightness = 50; // Color

        const color = `hsl(${hue}, 100%, ${lightness}%)`;
        document.body.style.backgroundColor = color;
        document.documentElement.style.backgroundColor = color;
    }, 50);

    // 激しい揺れ (Intense Shaking)
    setInterval(() => {
        const deg = Math.random() * 40 - 20; // -20 to 20 degrees
        const x = Math.random() * 40 - 20;   // Translate X
        const y = Math.random() * 40 - 20;   // Translate Y
        // Add random scale for extra chaos
        const scale = 0.8 + Math.random() * 0.4;

        document.body.style.transform = `translate(${x}px, ${y}px) rotate(${deg}deg) scale(${scale})`;
    }, 30);

    // Text & Element Chaos
    setInterval(() => {
        const headings = document.querySelectorAll('h1, h2, h3, p, a, button');
        headings.forEach(el => {
            el.style.color = `hsl(${Math.random() * 360}, 100%, 50%)`;
            if (Math.random() > 0.9) {
                el.style.fontSize = (Math.random() * 2 + 0.5) + 'em';
            }
        });
    }, 200);
}