# タスク3：音量調整UIを追加する

> 先に `01_context.md` を読むこと。タスク1（操作行のレイアウト変更）の後に着手推奨。

## ゴール
純正 iframe のコントロールを無効化（透明オーバーレイで遮断）した結果、**音量の大小を調整する手段が無い**（今あるのはミュートのトグルだけ）。代替の**音量調整UI**を画面内に置く。

## 現状
- `useTwitchPlayer.js` は `{ muted, toggleMute, paused, togglePlay }` だけを返す。**volume は未公開**。
- Twitch Player API には `setVolume(0〜1)` / `getVolume()` がある（`01_context.md` 参照）。
- UI 側（DpgkApp.jsx）の操作行 `.zap-controls` にミュートボタンはあるが音量スライダは無い。

## やること
### A. フックに音量を生やす（`useTwitchPlayer.js`）
1. `const [volume, setVolumeState] = useState(0.5)` のような状態を追加。
2. READY イベントで `setVolumeState(p.getVolume())` して実値に同期。
3. `setVolume = useCallback((v) => { p.setVolume(v); setVolumeState(v); /* v>0 ならミュート解除も検討 */ }, [])` を追加。
4. 戻り値に `volume, setVolume` を追加。`toggleMute` の既存挙動（アンミュート時に volume 0 なら 0.5 へ）は維持。
5. ミュートと音量の関係を整理：音量を 0 より大きくしたらミュート解除、スライダを 0 にしたら実質ミュート、という直感に合わせる（`setMuted` と `setVolume` を協調させる）。

### B. UIを置く（`DpgkApp.jsx` + `app.css`）
1. `useTwitchPlayer` の戻り値から `volume, setVolume` を受け取る。
2. 操作行（タスク1で動画下に移動した `.zap-controls`）か、その近くに音量コントロールを追加。実装は **`<input type="range" min=0 max=1 step=0.05>`** が素直。`onChange` で `setVolume(Number(e.target.value))`。
3. ミュートボタンと音量スライダを並べる（例：🔊 アイコン + スライダ）。ミュート中はスライダの見た目で分かるように（任意）。
4. CSS：`.zap-volume`（仮）クラスでスライダの幅・色をデザインに馴染ませる。range input のスタイルは最低限で可。
5. **キーボード操作との競合に注意**：スライダに矢印キーフォーカスが当たると `useZapControls` の ↑↓←→ と衝突し得る。`useZapControls` の `isTyping()` は INPUT を除外するので、スライダ操作中はショートカットが無効になり概ね問題ないが、スライダにフォーカスが残ったまま配信送りができなくなる体験は避けたい。挙動を確認し、不自然なら range ではなく「音量−/＋」ボタン2つ等の代替も検討してよい。

## 完了条件
- 画面内のUIで音量を**段階的に**変えられる（ミュートのオンオフだけでなく中間音量にできる）。
- 音量0でほぼ無音、上げると大きくなる（実 Twitch 視聴で確認）。
- ミュートボタンと矛盾しない（音量を上げたらミュート解除される等、直感的）。
- 既存のキーボード送り（↑↓←→等）が壊れない。

## 検証
- **音はデモでは出ない。** 実 Twitch ログイン状態（`/dpgk.html`、検索画面でログイン後に遷移）で実配信を再生して音量変化を確認する。
- レイアウト自体（スライダの見た目・配置）はデモでも確認可。
- 音の最終確認は人間にしかできないため、実装・配置まで終えたらユーザーに実機確認を依頼してよい。

## 注意
- コミットしない。
- `.zap-player-overlay` のフォーカス遮断は壊さない。
