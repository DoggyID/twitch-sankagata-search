# タスク1：操作ボタン類を「動画画面の真下」に設置する

> 先に `01_context.md` を読むこと。

## ゴール
操作ボタン行（↑前へ / ↓次へ / ←既視聴 / お気に入り→ / 🚫除外 / ミュート / Twitchで開く）を、**動画プレイヤーのすぐ真下**に置く。現状は画面最下部の全幅にあり、横長表示ではチャット欄の下にまでボタンが伸びていて不自然。動画と一体に見える配置にしたい。

## 現状（`01_context.md` のレイアウト図も参照）
`DpgkApp.jsx` の return 構造で、`.zap-controls`（操作ボタン行）は `.zap-body` の**外（下）**にある：
```
<div class="zap-body">
  <div class="zap-main"> <zap-player/> <zap-meta/> </div>
  {showChat && <div class="zap-chat"> … </div>}
</div>
<div class="zap-controls"> …ボタン群… </div>   ← ここ。全幅でチャットの下にも伸びる
<div class="zap-hint"> … </div>
```
CSS: `.zap-controls`（app.css 内、おおよそ475行付近）は `display:flex; flex-wrap:wrap; justify-content:center` の横帯。

## やること
`.zap-controls`（および必要なら `.zap-hint`）を **`.zap-main` の内側・`.zap-player` の下**へ移動する。`.zap-meta` との並び順は「動画 → 操作ボタン → メタ情報」か「動画 → メタ → 操作ボタン」のどちらか自然な方を選ぶ（動画直下にボタンを、というのが要望の核なので**動画のすぐ下にボタン**を優先）。

実装の要点：
1. JSX：`.zap-controls` ブロックを `.zap-main` 内へ移す。`current` が無い時（`.zap-empty` 表示時）の扱いに注意 — 現状 controls は `current` の有無に関わらず常時表示。移動後も、配信が無い時にボタンだけ宙に浮かない自然な見せ方にする（例：`current` がある時のみ controls を出す、等）。
2. CSS：`.zap-main` は `flex-direction: column` かつ `.zap-player` が `flex:1`。ボタン行を入れたら、`.zap-player` が縮みすぎないよう `.zap-controls` を `flex: 0 0 auto` 扱いにし、背景の `rgba(0,0,0,0.4)` 全幅帯から、動画幅に収まる見た目へ調整（角丸・余白など `.zap-main` のパディング内で自然に）。
3. `.zap-hint`（ショートカット説明文）は最下部の全幅のままでも、controls と一緒に動かしてもよい。読みやすさ優先で判断。
4. レスポンシブ：横長（チャット右）・縦長（チャット下）両方でボタンが動画の下に正しく収まること。`@media (max-width: 640px)` の `.zap-ctrl { flex: 1 1 40% }` は維持。

## 完了条件
- ボタン群が動画プレイヤーの直下に表示され、**チャット欄の下には伸びない**。
- 横長・縦長どちらでも崩れない。狭幅でもボタンが折り返して収まる。
- 既存の各ボタンの機能（prev/next/visited/fav/exclude/mute/Twitchで開く）は全て従来通り動く。

## 検証
- `http://localhost:5173/dpgk.html?demo=1`（レイアウトはデモで確認可）。
- preview_resize で横長・縦長・狭幅を切り替え、preview_screenshot で配置確認。
- 各ボタンクリックが効くこと（preview_click → preview_snapshot）。

## 注意
- コミットしない。
- 後続のタスク3（音量UI追加）でこのボタン行付近に要素が増える。拡張しやすいマークアップにしておくと良い。
