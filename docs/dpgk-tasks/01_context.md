# 01_context — DPGKモード コードマップ＆共通知識

> 毎セッション最初にこれを読む。各タスクファイルはこの内容を前提に書かれている。

## このアプリは何か

Twitch ライブ配信検索アプリ（React + Vite, 2ページ構成）。

- 検索画面 `index.html` → `src/App.jsx`
- **DPGKモード `dpgk.html` → `src/dpgk.jsx` → `src/components/ZapMode/DpgkApp.jsx`**（今回の改修対象）

DPGKモードは TikTok 風に配信を1本ずつ全画面表示し、↑↓←→等で切り替える。お気に入り/除外/既視聴は localStorage 共有。

## 改修に関わるファイル（これだけ把握すればよい）

| ファイル | 役割 |
| --- | --- |
| `src/components/ZapMode/DpgkApp.jsx` | DPGKページ本体（約330行）。レイアウトJSX・操作ハンドラ・状態 |
| `src/components/ZapMode/useTwitchPlayer.js` | Twitch Player JS API ラッパー（生成・mute・play/pause） |
| `src/components/ZapMode/useZapControls.js` | キーボード/スワイプ操作。入力欄フォーカス時は無効化 |
| `src/styles/app.css` | DPGK関連は `.zap-*` クラス（おおよそ 360〜521 行目） |
| `src/config.js` | `PLAYER_PARENT` など |

## 現在のレイアウト構造（DpgkApp.jsx の return）

```
<div class="zap-overlay (with-chat)">         ← flex column, 全画面
  <div class="zap-topbar"> … </div>           ← DPGK / 🔍検索 / その他⇔お気に入り / カウンタ / 再生停止 / 💬チャット / ×
  {showSearch && <div class="zap-search-panel"> SearchFilters </div>}
  <div class="zap-body">                        ← flex（横長=row, 縦長=column）
    <div class="zap-main">                      ← 動画側
      <div class="zap-player">
        <div id={playerId} class="zap-player-embed" />   ← ここに Twitch Player が入る
        <div class="zap-player-overlay" onClick={onMute} />  ← iframeにフォーカスを渡さない透明div
        {muted && <div class="zap-mute-indicator">🔇</div>}
        {paused && <div class="zap-pause-indicator">⏸</div>}
        {flash && <div class="zap-flash">…</div>}
      </div>
      <div class="zap-meta"> 配信者名/タイトル/視聴者/タグ </div>
    </div>
    {showChat && <div class="zap-chat"><iframe …/></div>}   ← チャット（横長=右, 縦長=下）
  </div>
  <div class="zap-controls"> ↑前へ ↓次へ ←既視聴 お気に入り→ 🚫除外 🔊ミュート Twitchで開く↗ </div>
  <div class="zap-hint"> ショートカット説明 </div>
</div>
```

**重要な構造ポイント:**
`.zap-controls`（操作ボタン行）は `.zap-body` の**外（下）**にあり、画面全幅に渡る。横長表示ではチャットの下にもボタンが伸びる。タスク1はこれを `.zap-main` の中（動画の真下、チャットの下には来ない）へ移す話。

## Twitch Player API（useTwitchPlayer.js）の要点

- `player.twitch.tv/js/embed/v1.js` を1回ロードし `new Twitch.Player(containerId, {...})` で生成。
- 素の iframe ではなく JS API を使う理由：親から `setMuted/getMuted/setVolume/getVolume/play/pause/setChannel` を制御できるから。
- チャンネル切替は `player.setChannel(channel)`（再生成しない）。
- 利用可能メソッド（公式）: `setMuted(bool)`, `getMuted()`, `setVolume(0〜1)`, `getVolume()`, `play()`, `pause()`, `setChannel(str)`。
- イベント: `Player.READY`, `Player.PLAY`, `Player.PLAYING`, `Player.PAUSE`。
- **現状の戻り値**: `{ muted, toggleMute, paused, togglePlay }`。音量(volume)は未公開。

### Twitch埋め込みの“クセ”（タスク2・4で重要）
- Twitch プレイヤーは**ミュート/音量状態をブラウザ側に永続化**する。`muted: false` で生成しても、ユーザーが以前ミュートしていれば復元され得る。
- **ミュート中**、Twitch は「クリックで音声オン」的な**消えない純正オーバーレイ**を出すことがある（＝やること.txt の「ミュートボタンが消えない」の主因candidate）。アンミュートすると出なくなる傾向。
- ブラウザの自動再生ポリシー上、音ありの autoplay はブロックされ得る（その場合 Twitch 側が自動ミュートする）。アンミュートを強制すると再生が止まる/警告が出る可能性があるため、READY 後に明示制御するのが安全。

## 透明オーバーレイ（.zap-player-overlay）の役割
iframe にキーボードフォーカスが入ると ↑↓←→ が Twitch 側に吸われて操作不能になる。それを防ぐため**透明divを被せてフォーカスを遮断**している。タップで `onMute`。
- 注意：`button` ではなく `div` で実装（global の `button:hover` が紫背景を付けてしまうため）。**この遮断機能は壊さないこと。**

## 検証環境

- 起動: ルートの `起動.ps1` ダブルクリック、または `npm install` → `npm run dev`。`http://localhost:5173/dpgk.html` を開く。
- **デモモード** `http://localhost:5173/dpgk.html?demo=1`：架空チャンネルなので**映像・音声は出ない**。→ レイアウト系（タスク1・5）の確認はデモで可。**音/ミュート/Twitch純正オーバーレイ（タスク2・3・4）はデモで検証できない**ため、実 Twitch ログイン状態で確認が必要。
- preview_* ツールがあればそれで起動・スナップショット・スクショ確認する（CLAUDE/環境の preview ワークフロー参照）。映像・音声の自動検証は不可なので、その旨をユーザーに伝え、最終確認を依頼してよい。

## 共通ルール（再掲・厳守）

- **`git commit` / `git push` は絶対にしない**（明示指示があるまで）。
- 既存の日本語コメント・命名・2スペースインデントに合わせる。
- `.zap-player-overlay` のフォーカス遮断を壊さない。
- 変更後はビルドが通ること（`npm run build` または lint）を確認。
