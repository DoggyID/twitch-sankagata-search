// --- 設定値 ---
const clientId = 'v4sb97ncaw1rbh8mizfg3ld7j5rkw2';
const redirectUri = (window.location.origin + window.location.pathname).replace(/\/index\.html$/, '/').replace(/\/?$/, '/');
const scope = 'user:read:email';

let currentAccessToken = null;

// --- DOM要素 ---
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

let visitedStreams = []; // Track clicked streams

// --- Dark Mode Elements ---
const themeToggle = document.getElementById('theme-toggle');
const themeLabel = document.getElementById('theme-label-text');

// --- 認証リンクの生成 ---
const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(scope)}`;
authLink.href = authUrl;

// --- 認証後の処理 (ページ読み込み時) ---
window.onload = function () {
    // --- Dark Mode Logic ---
    function setDarkMode(isDark) {
        if (isDark) {
            document.body.classList.add('dark-mode');
            themeToggle.checked = true;
            themeLabel.textContent = 'ダークモード';
            localStorage.setItem('theme', 'dark');
        } else {
            document.body.classList.remove('dark-mode');
            themeToggle.checked = false;
            themeLabel.textContent = 'ライトモード';
            localStorage.setItem('theme', 'light');
        }
    }

    // Check for saved theme in localStorage
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        setDarkMode(true);
    } else {
        setDarkMode(false); // Default to light
    }

    // Add listener for toggle
    themeToggle.addEventListener('change', () => {
        setDarkMode(themeToggle.checked);
    });


    // --- Auth Logic ---
    if (location.hash) {
        const fragmentParams = new URLSearchParams(location.hash.substring(1));
        const accessToken = fragmentParams.get('access_token');

        if (accessToken) {
            currentAccessToken = accessToken;
            console.log("Access Token:", currentAccessToken);
            authStatus.textContent = '認証成功！ゲーム名とフィルター条件を入力して配信を検索できます。';
            authStatus.style.color = 'green';
            authSection.style.display = 'none';
            searchSection.style.display = 'block';

            history.replaceState(null, document.title, window.location.pathname + window.location.search);
        } else {
            const error = fragmentParams.get('error_description');
            authStatus.textContent = `認証に失敗しました: ${error || 'アクセストークンを取得できませんでした。'}`;
            authStatus.style.color = 'red';
        }
    }

    // --- Segmented Control Logic ---
    const tagLogicControl = document.getElementById('tagLogicControl');
    tagLogicControl.addEventListener('click', (e) => {
        if (e.target.matches('.segmented-control-button')) {
            // Remove active class from all buttons in this control
            tagLogicControl.querySelectorAll('.segmented-control-button').forEach(btn => {
                btn.classList.remove('active');
            });
            // Add active class to the clicked button
            e.target.classList.add('active');
        }
    });

    // --- Load saved settings ---
    loadSettings();
    loadVisitedStreams();
};

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
    // Check if already in list
    if (!visitedStreams.some(s => s.user_login === stream.user_login)) {
        visitedStreams.unshift({
            user_login: stream.user_login,
            user_name: stream.user_name,
            title: stream.title,
            thumbnail_url: stream.thumbnail_url,
            viewed_at: new Date().toISOString()
        });
        // Limit history to 50 items
        if (visitedStreams.length > 50) visitedStreams.pop();
        saveVisitedStreams();
        updateVisitedUI();
    }
}

function updateVisitedUI() {
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
    // Visual feedback: Hide from search results
    const item = document.querySelector(`.stream-item[data-user="${stream.user_login}"]`);
    if (item) {
        item.style.display = 'none'; // Hide it instead of just graying it out
    }
}

// --- Settings Management ---
function saveSettings() {
    const settings = {
        gameName: gameNameInput.value,
        titleQuery: titleQueryInput.value,
        maxViewers: maxViewersInput.value,
        language: languageSelect.value,
        tagInput: tagInput.value,
        excludeTagInput: excludeTagInput.value,
        sortOrder: sortOrderSelect.value,
        tagLogic: document.querySelector('#tagLogicControl .segmented-control-button.active').dataset.logic
    };
    localStorage.setItem('twitchSearchSettings', JSON.stringify(settings));
}

function loadSettings() {
    const saved = localStorage.getItem('twitchSearchSettings');
    if (saved) {
        const settings = JSON.parse(saved);
        gameNameInput.value = settings.gameName || 'Overwatch 2';
        titleQueryInput.value = settings.titleQuery || '参加';
        maxViewersInput.value = settings.maxViewers || '';
        languageSelect.value = settings.language || 'ja';
        tagInput.value = settings.tagInput || '';
        excludeTagInput.value = settings.excludeTagInput || '';
        sortOrderSelect.value = settings.sortOrder || 'desc';

        if (settings.tagLogic) {
            const tagLogicControl = document.getElementById('tagLogicControl');
            tagLogicControl.querySelectorAll('.segmented-control-button').forEach(btn => {
                if (btn.dataset.logic === settings.tagLogic) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
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

    // 1. Clear Search Settings
    localStorage.removeItem('twitchSearchSettings');

    // 2. Clear Visited History
    localStorage.removeItem('twitchVisitedStreams');
    visitedStreams = [];
    updateVisitedUI();

    // 3. Reset Inputs
    gameNameInput.value = 'Overwatch 2';
    titleQueryInput.value = '参加';
    maxViewersInput.value = '';
    languageSelect.value = 'ja';
    tagInput.value = '';
    excludeTagInput.value = '';
    sortOrderSelect.value = 'desc';

    // 4. Reset Tag Logic to OR
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

    // Clear current search results as criteria changed
    streamsResultDiv.innerHTML = '<p>設定と履歴をリセットしました。「指定条件で配信を検索」ボタンを押して再検索してください。</p>';
    gameIdQueryResultDiv.innerHTML = '<p>ゲームID検索結果はここに表示されます。</p>';
    gameIdInput.value = '';
}

// --- ゲーム名検索と配信検索を連続して行うハンドラ ---
async function handleGameIdAndStreamSearch() {
    saveSettings();
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

// --- ゲームIDを名前で検索する機能 ---
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
            gameIdInput.value = game.id;
            return true;
        } else {
            gameIdQueryResultDiv.innerHTML = `<p>「${gameName}」という名前のゲームは見つかりませんでした。</p>`;
            gameIdInput.value = '';
            return false;
        }
    } catch (error) {
        console.error('APIリクエストエラー (ゲームID検索):', error);
        gameIdQueryResultDiv.innerHTML = `<p class="error">ゲームID検索中にエラーが発生しました:<br>${error.message}</p>`;
        gameIdInput.value = '';
        return false;
    }
}


// --- ライブ配信検索機能 (ページネーション対応) ---
async function searchLiveStreams() {
    if (!currentAccessToken) {
        streamsResultDiv.innerHTML = '<p class="error">エラー: Twitch認証が完了していません。</p>';
        return;
    }

    const gameId = gameIdInput.value.trim();
    if (!gameId) {
        return;
    }

    const maxViewers = parseInt(maxViewersInput.value.trim(), 10);
    const titleQuery = titleQueryInput.value.trim().toLowerCase();
    const selectedLanguage = languageSelect.value;
    const tagQueries = tagInput.value.split(',').map(t => t.trim().toLowerCase()).filter(t => t);
    const excludeTagQueries = excludeTagInput.value.split(',').map(t => t.trim().toLowerCase()).filter(t => t);
    const activeLogicButton = document.querySelector('#tagLogicControl .segmented-control-button.active');
    const tagLogic = activeLogicButton ? activeLogicButton.dataset.logic : 'OR'; // Default to OR

    // Initial search message
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
            // Update search message to show pagination progress
            if (page > 1) {
                streamsResultDiv.innerHTML = `<p>${searchMessage} (現在${allStreams.length}件取得済み、次のページを検索中...)</p>`;
            }

            let streamsApiUrl = `https://api.twitch.tv/helix/streams?game_id=${encodeURIComponent(gameId)}&first=100`;
            if (selectedLanguage) {
                streamsApiUrl += `&language=${selectedLanguage}`;
            }
            if (cursor) { // For subsequent pages
                streamsApiUrl += `&after=${cursor}`;
            }

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

            cursor = data.pagination.cursor; // Get cursor for next page

            // *** ADDED DELAY ***
            if (cursor) {
                // 次のページがある場合、サーバー負荷軽減のために300msの遅延を挿入します
                await new Promise(resolve => setTimeout(resolve, 300));
            }

            page++;

        } while (cursor); // Continue while there is a cursor for a next page

        // Now filter the complete list of streams
        let streamsToDisplay = allStreams;

        if (titleQuery) {
            streamsToDisplay = streamsToDisplay.filter(stream =>
                stream.title && stream.title.toLowerCase().includes(titleQuery)
            );
        }

        if (tagQueries.length > 0) {
            streamsToDisplay = streamsToDisplay.filter(stream => {
                if (!stream.tags || stream.tags.length === 0) return false;
                const streamTagsLower = stream.tags.map(t => t.toLowerCase());
                if (tagLogic === 'AND') {
                    return tagQueries.every(queryTag => streamTagsLower.includes(queryTag));
                } else { // OR
                    return tagQueries.some(queryTag => streamTagsLower.includes(queryTag));
                }
            });
        }

        if (excludeTagQueries.length > 0) {
            streamsToDisplay = streamsToDisplay.filter(stream => {
                if (!stream.tags || stream.tags.length === 0) {
                    return true; // No tags to exclude from, so keep the stream.
                }
                const streamTagsLower = stream.tags.map(t => t.toLowerCase());
                // If any of the stream's tags are in the exclude list, filter it out.
                const hasExcludedTag = excludeTagQueries.some(excludedTag => streamTagsLower.includes(excludedTag));
                return !hasExcludedTag;
            });
        }

        if (!isNaN(maxViewers) && maxViewers >= 0) {
            streamsToDisplay = streamsToDisplay.filter(stream => stream.viewer_count <= maxViewers);
        }


        // --- Store to global for resorts ---
        currentFilteredStreams = streamsToDisplay;

        // --- Sort streams initially ---
        const sortOrder = sortOrderSelect.value;
        if (sortOrder === 'asc') {
            currentFilteredStreams.sort((a, b) => a.viewer_count - b.viewer_count);
        } else {
            currentFilteredStreams.sort((a, b) => b.viewer_count - a.viewer_count);
        }

        // --- START: Fetch user profile pictures for FILTERED streams ---
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
                    headers: {
                        'Authorization': `Bearer ${currentAccessToken}`,
                        'Client-ID': clientId
                    }
                });
                const userData = await userResponse.json();
                if (userData.data) {
                    userData.data.forEach(user => {
                        userProfiles[user.id] = user.profile_image_url;
                    });
                }
                await new Promise(resolve => setTimeout(resolve, 300)); // Rate limit
            }

            currentFilteredStreams.forEach(stream => {
                stream.profile_image_url = userProfiles[stream.user_id];
            });

            displayStreams(currentFilteredStreams);
        } else {
            streamsResultDiv.innerHTML = `<p class="result-count">0件の配信が見つかりました。</p><p>指定された条件に一致するライブ配信は見つかりませんでした。</p>`;
        }
        // --- END: Fetch user profile pictures for FILTERED streams ---

    } catch (error) {
        console.error('APIリクエストエラー (ストリーム検索):', error);
        streamsResultDiv.innerHTML = `<p class="error">ライブ配信検索中にエラーが発生しました:<br>${error.message}</p>`;
    }
}

// --- Sorting Logic ---
let currentFilteredStreams = [];

function sortStreams() {
    const sortOrder = sortOrderSelect.value;
    if (sortOrder === 'asc') {
        currentFilteredStreams.sort((a, b) => a.viewer_count - b.viewer_count);
    } else {
        currentFilteredStreams.sort((a, b) => b.viewer_count - a.viewer_count);
    }
    // Update the sort info text if it exists (optional, or just re-render)
    displayStreams(currentFilteredStreams);
}

// Add event listener for sort change
sortOrderSelect.addEventListener('change', () => {
    if (currentFilteredStreams.length > 0) {
        sortStreams();
    }
});

function displayStreams(streams) {
    let htmlContent = `<p class="result-count">${streams.length}件の配信が見つかりました。</p>`;
    htmlContent += '<ul class="stream-list">';
    streams.forEach(stream => {
        const thumbnailUrl = stream.thumbnail_url
            .replace('{width}', '640')
            .replace('{height}', '360');

        const placeholderPfp = 'https://static-cdn.jtvnw.net/jtv_user_pictures/8a6381c7-d0c0-4576-b179-38bd5ce1d6af-profile_image-70x70.png';

        const isVisited = visitedStreams.some(s => s.user_login === stream.user_login);

        // Skip rendering if visited
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

    // Add click listeners to all links (Thumbnail and Title)
    // We re-query the items but we need to match them to the correct stream object.
    // However, since we might have skipped rendering visited streams, the index won't match 'streams' array directly if we used filtering logic inside displayStreams loop.
    // Wait, earlier we replaced the rendering logic to skip visited streams entirely in the loop. 
    // So 'streams' array contains ALL streams, but 'streamItems' only contains RENDERED (unvisited) streams.
    // Index mismatch is the cause. We must attach the stream object data or find it.

    // Better Approach: Use the data-user attribute to find the stream object.
    const streamMap = new Map(streams.map(s => [s.user_login, s]));

    const streamItems = streamsResultDiv.querySelectorAll('.stream-item');
    streamItems.forEach(item => {
        const userLogin = item.dataset.user;
        const stream = streamMap.get(userLogin);
        if (stream) {
            // Handle existing links (Open URL and mark visited)
            const links = item.querySelectorAll('a');
            links.forEach(link => {
                link.addEventListener('click', () => handleStreamClick(stream));
            });

            // Handle new "Mark as Visited" button (Mark visited without opening URL)
            const markVisitedBtn = item.querySelector('.mark-visited-btn');
            if (markVisitedBtn) {
                markVisitedBtn.addEventListener('click', (e) => {
                    handleStreamClick(stream);
                });
            }
        }
    });
}
