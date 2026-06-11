# twitch-sankagata-search

Twitch のライブ配信を、ゲーム名・タグ・タイトル・視聴者数などで絞り込んで検索できる Web アプリ。
お気に入り / 除外 / 既視聴の管理、サイドプレビュー、そして **TikTok風ザッピングモード** を備えています。

React + Vite 製で、GitHub Pages にデプロイされます。

## 必要環境

- Node.js 18 以降（推奨 20）

## セットアップ

```bash
npm install
```

## ローカルで動かす

### 1. デモモード（認証なし・表示確認用）

サンプルデータで UI・デザイン・ザッピングモードを即確認できます。Twitch 認証は不要です。

```bash
npm run dev
```

- `http://localhost:5173/?demo=1` を開く（または画面の「🎬 デモモード」ボタン）

> デモモードの配信プレイヤーは架空チャンネルのため映像は再生されません（レイアウト確認用）。

### 2. 実データ（localhost で Twitch 認証）

実際の Twitch API を使う場合は、[Twitch Developer Console](https://dev.twitch.tv/console) のアプリ設定で
**OAuth リダイレクト URL** に以下を登録してください:

```
http://localhost:5173/
```

登録後 `npm run dev` を起動し、`http://localhost:5173/` で「Twitch認証」からログインします。

## ビルド / プレビュー

```bash
npm run build     # dist/ に本番ビルドを出力
npm run preview   # ビルド結果をローカル確認
```

## デプロイ（GitHub Pages）

`main` への push で [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) が自動ビルド＆デプロイします。

初回のみ:

1. リポジトリ Settings → Pages → **Source: GitHub Actions** を選択
2. Twitch Developer Console の OAuth リダイレクト URL に本番 URL を追加:
   ```
   https://doggyid.github.io/twitch-sankagata-search/
   ```

> Vite の `base` は本番ビルド時のみ `/twitch-sankagata-search/` になります（ローカルは `/`）。

## 操作

### 検索画面

- ゲーム名・言語・タイトルキーワード・タグ(OR/AND)・除外タグ・最大視聴者数で絞り込み
- 配信カードをクリックで右側（モバイルは下）にプレビュー再生
- お気に入り ⭐ / 除外 🚫 / 既視聴の管理

### ザッピングモード ⚡（カオスモード 😺 の隣）

1配信ずつ全画面表示し、高速に切り替えられます。

| 操作 | キーボード | タッチ |
| --- | --- | --- |
| 次へ送る | ↓ | 上スワイプ |
| 前へ戻る | ↑ | 下スワイプ |
| お気に入り追加 | → | 画面ボタン |
| 既視聴にする | ← | 画面ボタン |
| 除外 | Delete | 画面ボタン |
| 閉じる | Esc | × ボタン |

上部のトグルで「その他」⇔「お気に入り」のリストを切り替えられます。
操作結果（お気に入り/既視聴/除外）は本体の検索画面にも即時反映されます。

## 構成

```
src/
├── main.jsx / App.jsx        アプリ本体
├── api/twitch.js             Twitch Helix API
├── hooks/                    auth / channels / visited / settings / theme
├── components/               Header, SearchFilters, Results, PreviewPanel, ...
│   └── ZapMode/              ザッピングモード
├── mock/mockStreams.js       デモモード用データ
└── styles/                   theme.css（Twitch風デザインシステム）+ app.css
```
