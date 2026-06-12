# Twitch ライブ配信検索 ＋ DPGKモード

Twitch のライブ配信を **ゲーム名・タグ・タイトル・視聴者数・言語** で細かく絞り込んで探せる Web アプリです。
気になった配信者の **お気に入り / 除外 / 既視聴** を管理でき、見つけた配信は **DPGKモード** で
TikTok のように 1 本ずつ全画面でザッピングしながら視聴できます。

2 つのページで構成されています。

| ページ | URL | 役割 |
| --- | --- | --- |
| 検索画面 | `/`（index.html） | 条件を指定して配信を検索・一覧・プレビュー |
| DPGKモード | `/dpgk.html` | 1 配信ずつ全画面でザッピング視聴 |

検索画面の **⚡ ボタン** から DPGKモードへ移動できます。お気に入り・除外・既視聴の情報は
両ページで共有されるので、どちらで操作しても結果はすぐに反映されます。

---

## 使い方

### 1. 起動する

いちばん簡単なのは、付属の起動スクリプトをダブルクリックする方法です。

- **`起動.ps1`** をダブルクリック（または PowerShell で `.\起動.ps1`）

Node.js が入っていれば、必要な準備を自動で行い、ブラウザでデモ画面を開きます。
Node.js が無い場合は [nodejs.org](https://nodejs.org/) からインストールしてください（推奨: 20 以降）。

> 手動で起動する場合は、ターミナルで `npm install` → `npm run dev` を実行し、
> 表示された `http://localhost:5173/` を開きます。

### 2. まずはデモで試す（認証不要）

サンプルデータで画面・操作感をすぐ確認できます。Twitch アカウントは不要です。

- `http://localhost:5173/?demo=1` を開く（または検索画面の「🎬 デモモード」ボタン）

> デモの配信プレイヤーは架空チャンネルのため映像は再生されません（レイアウト確認用）。

### 3. 実際の配信を検索する（Twitch ログイン）

本物の配信を検索するには Twitch ログインが必要です。

1. `http://localhost:5173/` を開く
2. 「Twitch認証」からログイン
3. ゲーム名などの条件を入れて検索

ログイン状態は DPGKモードのページにも引き継がれます。

> **初回のみ開発者設定が必要です。** [Twitch Developer Console](https://dev.twitch.tv/console) で
> アプリの **OAuth リダイレクト URL** に `http://localhost:5173/` を登録してください。

---

## 検索画面でできること

- ゲーム名 / 言語 / タイトルキーワード / タグ（OR・AND）/ 除外タグ / 最大視聴者数で絞り込み
- 配信カードをクリックすると、その場でプレビュー再生（横長画面は右、縦長画面は下）
- ⭐ お気に入り / 🚫 除外 / 既視聴 の登録・管理
- 😺 カオスモード（おまけ）/ ⚡ DPGKモードへ移動

---

## DPGKモード（⚡）の操作

配信を 1 本ずつ全画面で表示し、サクサク切り替えながら視聴できます。
チャット欄は横長画面では右、縦長画面では下に表示します（💬 ボタンで表示/非表示）。
画面上部の **🔍 検索** から、DPGKモードのまま検索条件を変えて配信を探し直せます。

| 操作 | キーボード | 画面ボタン / タッチ |
| --- | --- | --- |
| 次へ送る | ↓ | ボタン / 上スワイプ |
| 前へ戻る | ↑ | ボタン / 下スワイプ |
| お気に入りに追加 | → | ボタン |
| 既視聴にする | ← | ボタン |
| 除外する | Delete | ボタン |
| 再生 / 一時停止 | Space（メディアキーも可） | 上部ボタン |
| ミュート切替 | M | ボタン / 動画タップ |
| Twitch で開く | Enter | ボタン |
| 検索画面に戻る | Esc | × ボタン |

- 上部のトグルで **「その他」⇔「お気に入り」** のリストを切り替えられます。
- **お気に入り / 既視聴 / 除外にした配信は、その場でフィードから消えます。**
  既視聴にした配信が「↑ 前へ」で再び出てくることはありません。
- 動画プレイヤーのネイティブ操作（音量・全画面など）は無効化されています。
  操作はキーボードと画面下のボタンに集約しています。

---

## ビルド / デプロイ

```bash
npm run build     # dist/ に本番ビルド（index.html と dpgk.html の 2 ページ）を出力
npm run preview   # ビルド結果をローカル確認
```

`main` ブランチへ push すると [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) が
自動でビルドして GitHub Pages へ公開します。公開 URL は
<https://doggyid.github.io/twitch-sankagata-search/> です。

> 本番では Twitch Developer Console の OAuth リダイレクト URL に
> `https://doggyid.github.io/twitch-sankagata-search/` も登録してください。

---

## 構成

```
twitch-sankagata-search/
├── index.html / dpgk.html        2 つのページのエントリ
├── src/
│   ├── main.jsx / App.jsx         検索画面
│   ├── dpgk.jsx                   DPGKモードのエントリ
│   ├── components/
│   │   ├── ZapMode/DpgkApp.jsx    DPGKモード本体
│   │   └── ...                    Header / SearchFilters / Results / PreviewPanel ほか
│   ├── hooks/                     auth / channels / visited / settings / theme / streamSearch
│   ├── api/twitch.js              Twitch Helix API
│   ├── mock/mockStreams.js        デモ用データ
│   └── styles/                    theme.css（Twitch風デザイン）+ app.css
└── 起動.ps1                       ローカル起動スクリプト
```
