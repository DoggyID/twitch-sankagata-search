# タスク5：✖ボタンを「退出」ボタンにする

> 先に `01_context.md` を読むこと。最も軽いタスクなので最初に着手推奨。

## ゴール
DPGKモードを抜けるための右上の `×` を、**「退出」と分かる明示的なボタン**に変える。アイコンだけの ✖ は分かりにくい、というユーザー要望。

## 現状
`DpgkApp.jsx` の topbar 末尾（onClose を呼ぶ要素）:
```jsx
<button type="button" className="zap-close" aria-label="検索画面に戻る" onClick={onClose}>×</button>
```
- `onClose` は `homeUrl()` へ遷移（検索画面に戻る）。挙動は変えない。
- CSS は `app.css` の `.zap-close`（大きな ✖ 用：`font-size: 1.6rem` 等、ホバーで赤文字）。

## やること
1. ラベルを「退出」等のテキストにする（例：`← 退出` や `退出 ↩`。`aria-label` は「検索画面に戻る」のままで可、または「DPGKモードを退出」に更新）。
2. テキストボタンとして見栄えを整える。`.zap-close` の現スタイルは ✖ 一文字前提なので、テキスト用に CSS を調整する（topbar の他ボタン `.zap-chat-toggle` のトーンに寄せると統一感が出る。枠付き・小さめ・ホバーで赤系、など）。
3. topbar 内での位置は現状どおり右端でよい。

## 完了条件
- 右上が「退出」と読めるボタンになっている。
- クリックで従来どおり検索画面（`homeUrl`）へ戻る。
- レイアウト崩れ・はみ出しがない（横幅が狭い時も topbar が破綻しない）。

## 検証
- `npm run dev` →  `http://localhost:5173/dpgk.html?demo=1`（デモで可）。
- preview_screenshot で topbar の見た目を確認。クリックで `/dpgk.html` → `/`（index）へ遷移することを確認。

## 注意
- コミットしない。挙動（遷移先）は変えない。見た目とラベルのみ。
