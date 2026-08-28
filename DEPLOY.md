# デプロイ手順

公開先は **Cloudflare Pages** に移行済み。GitHub Pages は当面そのまま並行運用する
（安定を確認したら `.github/workflows/deploy.yml` を削除してよい）。

| 環境 | URL | 反映のきっかけ | 所要 |
| --- | --- | --- | --- |
| Cloudflare Pages（本番） | `https://twitch-sankagata-search.pages.dev/` | `npm run deploy` / main への push | 約15〜60秒 |
| Cloudflare Pages（プレビュー） | `https://preview.twitch-sankagata-search.pages.dev/` | `npm run deploy:preview` | 約15秒 |
| GitHub Pages（旧・並行運用） | `https://doggyid.github.io/twitch-sankagata-search/` | main への push | 数分 |

`base` は環境変数 `BASE_PATH` で切り替える。既定は `/`（ローカル開発と Cloudflare Pages）。
GitHub Pages 用のワークフローだけが `BASE_PATH=/twitch-sankagata-search/` を渡している。

---

## 初回セットアップ（1回だけ）

### 1. Cloudflare にログインして Pages プロジェクトを作る

```bash
npx wrangler login
```

ブラウザが開くので Cloudflare アカウントで許可する。続いてプロジェクトを作成する。

```bash
npx wrangler pages project create twitch-sankagata-search --production-branch=main
```

プロジェクト名は `wrangler.toml` の `name` と一致させること。作られる URL は
`https://twitch-sankagata-search.pages.dev/`。

### 2. Twitch の OAuth リダイレクト URL を追加する

[Twitch Developer Console](https://dev.twitch.tv/console) → 対象アプリ →
**OAuth リダイレクト URL** に次を追加する（末尾のスラッシュまで完全一致が必要）。

```
https://twitch-sankagata-search.pages.dev/
https://preview.twitch-sankagata-search.pages.dev/
```

既存の `http://localhost:5173/` と GitHub Pages の URL は消さずに残す（並行運用のため）。

> リダイレクト URL はワイルドカード不可。`npm run deploy:preview` がブランチ名 `preview` を
> 固定で使っているのはこのため。コミットごとの `<hash>.…pages.dev` では認証は通らないので、
> その URL で確認したいときは `?demo=1` のデモモードを使う。

### 3.（任意）push で自動デプロイできるようにする

`.github/workflows/deploy-cloudflare.yml` は Secrets が未設定のうちはスキップするだけで
失敗しない。有効化するには GitHub リポジトリの
**Settings → Secrets and variables → Actions** に次の 2 つを登録する。

| Secret 名 | 取得場所 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare ダッシュボード → My Profile → API Tokens → Create Token → テンプレート **Edit Cloudflare Workers**（または権限 `Account / Cloudflare Pages / Edit`） |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare ダッシュボードの URL に含まれる 32 桁の ID（`npx wrangler whoami` でも確認できる） |

---

## ふだんのデプロイ

### 本番へ即時反映（推奨・いちばん速い）

```bash
npm run deploy
```

ビルド → アップロードまでローカルで完結する。git push も CI も待たない。
HTML は `public/_headers` で `Cache-Control: no-store` にしてあるので、
デプロイ完了後にリロードすれば必ず新しい版が出る（強制リロード不要）。

### プレビュー環境へ

```bash
npm run deploy:preview
```

本番を壊さずに `https://preview.twitch-sankagata-search.pages.dev/` で確認できる。

### push で自動（Secrets 設定済みの場合）

`main` に push すると `deploy-cloudflare.yml` が本番へデプロイする。

---

## トラブルシューティング

- **`wrangler pages deploy` がプロジェクトを見つけられない**
  `wrangler.toml` の `name` と Cloudflare 上のプロジェクト名が一致しているか確認する。
  一覧は `npx wrangler pages project list`。

- **Twitch ログインで `redirect_uri` エラー**
  今開いている URL（末尾スラッシュ込み）が Developer Console に登録されているか確認する。
  アプリは `window.location` からリダイレクト URI を組み立てるので、
  ドメインが変わったら必ず登録が要る。

- **古い画面が出る**
  `dist/_headers` がアップロードされているか確認する（`npm run build` 後に
  `dist/_headers` が存在すること）。`public/` 配下は Vite が dist 直下へコピーする。

- **URL が `/dpgk.html` ではなく `/dpgk` になる**
  Cloudflare Pages の既定動作で、`.html` 付き URL は拡張子なしのパスへ 308 リダイレクトされる
  （クエリは保持される）。アプリ内リンクは `dpgk.html` のままで正しく動く。
  ただし拡張子なしのパスは `_headers` の `/*.html` にマッチしないため、
  `public/_headers` では `/dpgk` を個別に列挙している。ページを増やしたら同様に追記すること。

- **配信プレイヤーが真っ黒**
  Twitch 埋め込みの `parent` は `window.location.hostname` から自動で入る（`src/config.js`）。
  独自ドメインを足した場合もコード変更は不要。
