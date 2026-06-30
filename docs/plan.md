# 検索クエリ入力欄とパネル幅のスマート化

## Context
`twitch-sankagata-search` の検索画面で2点の見た目の問題が指摘された。

1. ゲーム名検索の入力欄（`GameNameInput`）が縦にも横にも間延びしていて、スマートな検索バーに見えない。
2. `.container` に `max-width: 1280px` の固定値が掛かっており、高解像度モニターでフルスクリーン表示しても左右に大きな余白ができ、まるでモバイルサイトのように細長く見える。

CSSは plain CSS（`src/styles/app.css` + `src/styles/theme.css`、CSS変数によるテーマシステム）で一元管理されている。コンポーネント構造は変更せず、CSSの調整のみで解決する。

## 変更1: パネル最大幅をビューポート追従に変更

`src/styles/app.css:18-25` の `.container`:

```css
.container {
  max-width: 1280px;
  ...
}
```

を、画面幅に応じて伸びる可変幅に変更する：

```css
.container {
  max-width: min(1600px, 94vw);
  ...
}
```

- 高解像度モニターでは横に大きく伸び、フルHD以下では従来とほぼ同じ見た目を維持する。
- `body { padding: var(--space-5); }` はそのまま（左右の余白として機能する）。

### 付随調整: フィルターグリッドの広幅ブレークポイント追加
`src/styles/app.css:166-171` の既存 `@media (min-width: 1024px)` に加えて、より広い画面用のブレークポイントを追加し、コンテナが広がった分のスペースを `filter-options-fields` グリッドでも活かす：

```css
@media (min-width: 1440px) {
  .filter-options-fields { grid-template-columns: repeat(6, 1fr); }
  .filter-group.title-filter, .filter-group.tag-filter { grid-column: span 2; }
  .filter-group.viewers-filter, .filter-group.language-filter, .filter-group.sort-order { grid-column: span 1; }
}
```

（既存の列数・spanルールを踏襲し、列数だけ4→6に増やす。`.stream-list` は単一カラムのままなので結果カードは横幅が伸びて見やすくなるだけで、変更不要。）

## 変更2: ゲーム名検索入力欄をコンパクトな検索バーに

対象: `src/styles/app.css:131-139`（`.game-id-query-section` と `#gameNameInput`）

現状:
```css
.game-id-query-section,
.filter-options-wrapper {
  margin-bottom: var(--space-5);   /* 24px */
  padding-bottom: var(--space-4);  /* 16px */
  border-bottom: 1px solid var(--border-color-light);
}
.game-id-query-section input#gameNameInput {
  display: block; width: 100%; max-width: 600px; margin-top: var(--space-2);
}
```

問題点:
- `max-width: 600px` の単一行テキスト入力は、ゲーム名検索という用途に対して横長すぎる。
- セクション自体に `margin-bottom: 24px` + `padding-bottom: 16px` + 罫線があり、見出し(h3)・余白・入力欄だけで縦に大きなブロックになっている。

修正方針: `.game-id-query-section` だけ専用ルールを設け、間延びを解消する。

```css
.game-id-query-section {
  margin-bottom: var(--space-4);   /* 24px → 16px に圧縮 */
  padding-bottom: var(--space-3);  /* 16px → 12px に圧縮 */
  border-bottom: 1px solid var(--border-color-light);
}
.game-id-query-section input#gameNameInput {
  display: block;
  width: 100%;
  max-width: 380px;               /* 600px → 380px、検索バーらしい幅に */
  margin-top: var(--space-2);
}
```

（`.filter-options-wrapper` は現行の `margin-bottom: var(--space-5); padding-bottom: var(--space-4);` を維持。両者を分離するため、現在まとめて指定されているセレクタを分割する。）

これにより:
- 横方向: 600px→380pxで、見出しに対して不自然に伸びていた入力欄が適切な検索バー幅になる。
- 縦方向: セクションの余白を詰めることで、見出し直下に間延びした空白ができなくなる。

入力欄自体の `padding: 10px 12px`（`app.css:42-59`、全テキスト入力共通）は他のフィルター入力と統一性があるため変更しない。

## 変更3: 言語選択チェックボックスの横幅が巨大化するバグの修正

対象: `src/styles/app.css:143`

```css
.filter-group input, .filter-group select { width: 100%; }
```

このルールは `type` を問わず `.filter-group` 配下の **全ての** `<input>` に `width: 100%` を強制している。`LanguageSelect`（`src/components/LanguageSelect.jsx`）のチェックボックス一覧（`.language-select-panel` 内の `.language-option label > input[type="checkbox"]`）も `.filter-group.language-filter` の子孫であるため、このルールに巻き込まれてチェックボックスが行幅いっぱいに巨大化してしまっている。これが「言語選択のチェックボックスの横幅がデカすぎる」問題の原因。

修正: テキスト/数値入力とセレクトのみに絞るか、チェックボックスを明示的に除外する。後方互換重視で除外パターンを採用する。

```css
.filter-group input:not([type="checkbox"]), .filter-group select { width: 100%; }
```

加えて `.language-option`（`src/styles/app.css:609-616`）にチェックボックス自体のサイズを明示しておく（ブラウザ既定の見た目を保証するため）:

```css
.language-option input[type="checkbox"] {
  width: auto;
  flex: 0 0 auto;
}
```

## 検証
1. `npm run dev` で開発サーバーを起動し、ブラウザでプレビュー。
2. デモモード（`?demo=1`）でログイン不要の画面を確認。
3. ブラウザ幅を狭め（〜768px）・広げ（1920px以上）の両方で:
   - ゲーム名検索欄が短くまとまっているか
   - `.container` が高解像度幅でも適切に広がり、余白だらけにならないか
   - フィルターグリッドが広幅で崩れず6列に展開するか
   - `.results-with-preview` の2カラムレイアウトが破綻しないか
4. 言語フィルターの「▾」ボタンを開き、チェックボックスが通常サイズ（テキストの先頭に小さく表示）に戻っているか確認。
5. ダークモード切り替えでも見た目に問題がないか確認。