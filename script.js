// --- 設定値 ---
const clientId = 'v4sb97ncaw1rbh8mizfg3ld7j5rkw2'; // Make sure this matches your Twitch Console Client ID
const scope = 'user:read:email';

let currentAccessToken = null;

// --- DOM要素 (Script assumed to be at end of body) ---
const authLink = document.getElementById('authLink');
const authStatus = document.getElementById('authStatus');
const authSection = document.getElementById('authSection');
const searchSection = document.getElementById('searchSection');
const streamsResultDiv = document.getElementById('streamsResult');
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
    if (!confirm('検索条件の設定および視聴済み履歴（キャッシュ）をすべてリセットし、初期状態に戻しますか？')) {
        return;
    }
    localStorage.removeItem('twitchSearchSettings');
    localStorage.removeItem('twitchVisitedStreams');
    visitedStreams = [];
    updateVisitedUI();

    if (gameNameInput) gameNameInput.value = 'Overwatch 2';
    if (titleQueryInput) titleQueryInput.value = '参加';
    if (maxViewersInput) maxViewersInput.value = '';
    if (languageSelect) languageSelect.value = 'ja';
    if (tagInput) tagInput.value = '';
    if (excludeTagInput) excludeTagInput.value = '';
    if (sortOrderSelect) sortOrderSelect.value = 'desc';

    const tagLogicControl = document.getElementById('tagLogicControl');
    if (tagLogicControl) {
        tagLogicControl.querySelectorAll('.segmented-control-button').forEach(btn => {
            if (btn.dataset.logic === 'OR') {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    if (streamsResultDiv) streamsResultDiv.innerHTML = '<p>設定と履歴をリセットしました。「指定条件で配信を検索」ボタンを押して再検索してください。</p>';
    if (gameIdQueryResultDiv) gameIdQueryResultDiv.innerHTML = '<p>ゲームID検索結果はここに表示されます。</p>';
    if (gameIdInput) gameIdInput.value = '';
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
            streamsResultDiv.innerHTML = '<p class="error">指定されたゲーム名が見つからなかったため、配信を検索できません。</p>';
        }
    } else {
        gameIdQueryResultDiv.innerHTML = '<p class="error">検索するゲーム名を入力してください。</p>';
        streamsResultDiv.innerHTML = '';
    }
}

// --- Get Game ID ---
async function getGameIdByName(gameName) {
    if (!currentAccessToken) {
        gameIdQueryResultDiv.innerHTML = '<p class="error">エラー: Twitch認証が完了していません。</p>';
        return false;
    }

    gameIdQueryResultDiv.innerHTML = `<p>「${gameName}」のIDを検索中...</p>`;
    streamsResultDiv.innerHTML = '';
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
        streamsResultDiv.innerHTML = '<p class="error">エラー: Twitch認証が完了していません。</p>';
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
    streamsResultDiv.innerHTML = `<p>${searchMessage}</p>`;

    let allStreams = [];
    let cursor = null;
    let page = 1;

    try {
        do {
            if (page > 1) {
                streamsResultDiv.innerHTML = `<p>${searchMessage} (現在${allStreams.length}件取得済み、次のページを検索中...)</p>`;
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
            streamsResultDiv.innerHTML = `<p>${currentFilteredStreams.length}件の配信が見つかりました。配信者のアイコンを取得中... (並び替え: ${sortOrder === 'asc' ? '視聴者数が少ない順' : '視聴者数が多い順'})</p>`;
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

            displayStreams(currentFilteredStreams);
        } else {
            streamsResultDiv.innerHTML = `<p class="result-count">0件の配信が見つかりました。</p><p>指定された条件に一致するライブ配信は見つかりませんでした。</p>`;
        }

    } catch (error) {
        console.error('APIリクエストエラー (ストリーム検索):', error);
        streamsResultDiv.innerHTML = `<p class="error">ライブ配信検索中にエラーが発生しました:<br>${error.message}</p>`;
    }
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
        displayStreams(currentFilteredStreams);
    }
}

sortOrderSelect.addEventListener('change', () => {
    if (currentFilteredStreams.length > 0) {
        sortStreams(true);
    }
});

function displayStreams(streams) {
    let htmlContent = `<p class="result-count">${streams.length}件の配信が見つかりました。</p>`;
    htmlContent += '<ul class="stream-list">';
    streams.forEach(stream => {
        const thumbnailUrl = stream.thumbnail_url.replace('{width}', '640').replace('{height}', '360');
        const placeholderPfp = 'https://static-cdn.jtvnw.net/jtv_user_pictures/8a6381c7-d0c0-4576-b179-38bd5ce1d6af-profile_image-70x70.png';
        const isVisited = visitedStreams.some(s => s.user_login === stream.user_login);

        if (isVisited) return;

        htmlContent += `
            <li class="stream-item" data-user="${stream.user_login}">
                <div class="thumbnail-wrapper">
                    <img src="${thumbnailUrl}" alt="${stream.user_name} の配信サムネイル" class="thumbnail">
                </div>
                <div class="stream-info">
                    <h3><a href="https://twitch.tv/${stream.user_login}" target="_blank" rel="noopener noreferrer">${stream.title || '(タイトルなし)'}</a></h3>
                    <p>
                        <img src="${stream.profile_image_url || placeholderPfp}" alt="" class="streamer-pfp">
                        配信者: <strong>${stream.user_name} (${stream.user_login})</strong>
                    </p>
                    <p>視聴者数: <strong>${stream.viewer_count.toLocaleString()}</strong> 人</p>
                </div>
                <div class="stream-actions">
                    <button class="mark-visited-btn">既視聴にする</button>
                </div>
            </li>
        `;
    });
    htmlContent += '</ul>';
    streamsResultDiv.innerHTML = htmlContent;

    const streamMap = new Map(streams.map(s => [s.user_login, s]));
    const streamItems = streamsResultDiv.querySelectorAll('.stream-item');
    streamItems.forEach(item => {
        const userLogin = item.dataset.user;
        const stream = streamMap.get(userLogin);
        if (stream) {
            const links = item.querySelectorAll('a');
            links.forEach(link => {
                link.addEventListener('click', () => handleStreamClick(stream));
            });
            const markVisitedBtn = item.querySelector('.mark-visited-btn');
            if (markVisitedBtn) {
                markVisitedBtn.addEventListener('click', (e) => {
                    handleStreamClick(stream);
                });
            }
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
    let hue = 0;
    setInterval(() => {
        document.body.style.backgroundColor = `hsl(${hue}, 100%, 50%)`;
        document.documentElement.style.backgroundColor = `hsl(${hue}, 100%, 50%)`;
        hue = (hue + 20) % 360;
    }, 50);

    setInterval(() => {
        const deg = Math.random() * 20 - 10;
        document.body.style.transform = `rotate(${deg}deg)`;
    }, 100);

    setInterval(() => {
        const headings = document.querySelectorAll('h1, h2, h3, p, a, button');
        headings.forEach(el => {
            el.style.color = `hsl(${Math.random() * 360}, 100%, 50%)`;
            if (Math.random() > 0.9) {
                el.style.fontSize = (Math.random() * 2 + 0.5) + 'em';
            }
        });
    }, 500);
}