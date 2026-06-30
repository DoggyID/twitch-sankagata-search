# DPGKモード：次配信プリロード 詳細開発計画

> このファイルは実装担当へ渡す開発計画書。現時点では実装しない。
> 目的は「Twitch 埋め込みプレイヤーを毎回作り直す」現状を、実装可能性を検証しながら段階的に改善すること。

## 0. 参照する現状コード

対象は DPGK 専用ページ。

- `src/components/ZapMode/DpgkApp.jsx`
- `src/components/ZapMode/useZapControls.js`
- `src/styles/app.css`
- `dpgk.html`
- 必要に応じて `src/hooks/useFeed.js`

現在の動画表示は `DpgkApp.jsx` の素の iframe。

```jsx
const playerSrc = useMemo(() => {
  if (!current) return '';
  return `https://player.twitch.tv/?channel=${encodeURIComponent(current.user_login)}&parent=${encodeURIComponent(PLAYER_PARENT)}&muted=false&autoplay=true`;
}, [current]);

// ...
<iframe
  key={current.user_login}
  src={playerSrc}
  allowFullScreen
  allow="autoplay; encrypted-media"
  title="Twitch DPGK player"
/>
```

`current = feed[index]` で、`next()` / `prev()` は `index` を増減するだけ。`key={current.user_login}` のため、配信切り替えのたびに iframe がアンマウントされ、Twitch player が初期ロードからやり直しになる。

## 1. ゴール

- 通常の `next()` で次の配信へ切り替えた時、すでに裏で準備済みのプレイヤーを表へ出し、体感ロードを減らす。
- アクティブな配信だけ音声ありで再生する。裏で準備する配信は必ずミュートする。
- 先読みが間に合わない場合は、クラッシュや二重音声を起こさず、従来同等のロードにフォールバックする。
- Twitch の埋め込み要件に反する実装は採用しない。

非ゴール:

- すべての高速連打を完全に無ロード化すること。
- チャット iframe のプリロード。
- 最初から双方向かつ3スロットを完成させること。
- Twitch プレイヤー内部 UI をクロスオリジン越しに改造すること。

## 2. 最重要制約

Twitch embed は次の制約を満たす必要がある。

- `parent` を正しく渡す。
- 埋め込み動画は最低 400x300px を満たす。
- autoplay 開始には最小サイズと可視性が必要。
- Twitch embed はページ要素で不適切に隠したり覆ったりしない。

公式ドキュメント:

- https://dev.twitch.tv/docs/embed/
- https://dev.twitch.tv/docs/embed/video-and-clips/
- https://dev.twitch.tv/docs/embed/everything/

このため、旧案の「非アクティブスロットを `visibility:hidden` にして裏で再生し続ける」は実装前に必ず検証する。検証で autoplay / buffering が成立しない、または Twitch の要件に抵触する場合、その CSS 方針は破棄する。

## 3. 技術方針

素の iframe の `src` 差し替えでは、ミュート解除やチャンネル変更を iframe 作り直しなしに行えない。プリロード済み iframe を表に出す時に `muted=false` へ変えるだけでも再ロードになる。

そのため、Twitch の JavaScript Embed API を使い、固定コンテナに対してプレイヤーを生成する。

```html
<script src="https://player.twitch.tv/js/embed/v1.js"></script>
```

```js
const player = new Twitch.Player(containerId, {
  width: '100%',
  height: '100%',
  channel: login,
  parent: [PLAYER_PARENT],
  muted: true,
  autoplay: true,
});
```

実装では `width` / `height` を必ず指定する。`setChannel()`, `setMuted()`, `setVolume()`, `setQuality()`, `getQualities()`, `getPlaybackStats()`, `play()`, `pause()` などの制御は、`READY` 後に呼ぶ前提で扱う。

## 4. アーキテクチャ

新規フック候補:

- `src/components/ZapMode/usePlayerPool.js`

責務:

- Twitch embed script の idempotent なロード。
- 固定スロット DOM と `Twitch.Player` インスタンスの対応管理。
- `feed` と `index` から必要なチャンネルを計算。
- アクティブ昇格、ミュート制御、次チャンネルのプリロード。
- プレイヤーイベントの観測とデバッグ状態の公開。
- unmount 時の後始末。

### 4.1 スロット

Step 1 は2スロット構成に限定する。

- `active`: 現在視聴中。
- `preloadNext`: `feed[index + 1]`。

Step 2 でのみ3スロット構成を検討する。

- `active`
- `preloadNext`
- `warmPrev`: 直前の active を温存。

各スロット状態の例:

```js
{
  slotId: 'zap-player-slot-0',
  login: 'example_login',
  role: 'active',
  ready: true,
  playing: true,
  muted: false,
  quality: null,
  assignmentToken: 42,
  lastAssignedAt: 1234567890,
  lastError: null,
}
```

### 4.2 スロット再割り当て

`index` 変更時に次を計算する。

```js
const wanted = {
  active: feed[index]?.user_login ?? null,
  preloadNext: feed[index + 1]?.user_login ?? null,
};
```

処理順:

1. `wanted.active` を保持するスロットがあれば、それを active に昇格する。
2. なければ、最も不要なスロットへ `setChannel(wanted.active)` し、ロードありのフォールバックとして active にする。
3. active 以外のスロットは必ず `setMuted(true)` にする。
4. active 昇格時は `setMuted(false)` に加え、可能なら通常画質へ戻す。画質指定は `getQualities()` の戻り値に存在する値だけを使う。
5. `wanted.preloadNext` が未保持なら、preload 用スロットへ `setChannel(wanted.preloadNext)` し、`setMuted(true)` のまま `play()` を試みる。
6. preload / warmPrev は、可能なら低画質へ落とす。候補は `160p30` などだが、必ず `getQualities()` で存在確認してから `setQuality()` する。存在しない場合は画質変更しない。
7. `feed[index + 1]` がない場合は preload スロットを idle にする。可能なら `pause()` する。

同じ login に対して無駄な `setChannel()` を呼ばない。`setChannel()` の直後はロード中状態として扱い、`READY` / `PLAYING` / タイムアウトで状態を更新する。

`setChannel()` 後に `READY` が再発火するかは実装前に検証する。初期化時とチャンネル変更時でイベント順序が違う可能性があるため、状態管理は `READY` だけに依存しない。`PLAY`, `PLAYING`, `ONLINE`, `OFFLINE`, `PLAYBACK_BLOCKED`, `getChannel()`, `getPlaybackStats()` も観測対象に含める。

非同期競合対策として、スロットへ login を割り当てるたびに単調増加の `assignmentToken` を発行する。イベントリスナー、タイムアウト、`setChannel()` 後の Promise 風処理、品質変更処理は、処理開始時に捕捉した token と現在のスロット token が一致する場合だけ状態を書き換える。一致しない場合は古いイベントとして破棄する。

画質変更は `setChannel()` 直後に実行しない。直後の `getQualities()` は空配列、または前チャンネルの品質一覧を返す可能性があるため、対象スロットの `PLAYING`、または M1 で確認した画質確定相当イベントを受け、かつ `assignmentToken` が一致している時だけ `getQualities()` -> `setQuality()` を試みる。

### 4.3 feed 更新時の扱い

単純に「feed が変わったら全リセット」はしない。

実コードでは `useFeed()` が、検索結果、source、お気に入り、除外、既視聴をもとに毎回リストを作り直す。`onFavorite`, `onVisited`, `onExclude` はユーザー操作の中心であり、ここで毎回プレイヤープールを破棄するとプリロードの効果が失われる。

方針:

- `current?.user_login` が同じなら、プールは維持する。
- `current` が feed から消えた場合は、React 側の `index` 補正後に新しい `wanted` へ差分適用する。プール側の再割当て処理は、必ず補正後（`feed.length` に対して範囲内になった）の `index` にのみ依存させる。`DpgkApp.jsx` 既存の補正 effect（44-50行）とプール側 effect の実行順が前後すると、補正前の stale な `index` を一瞬掴んで誤ったチャンネルへ `setChannel()` してしまう可能性がある。`assignmentToken` により実害（誤ったチャンネルがactiveのまま固定される）は出にくいはずだが、無駄な `setChannel()` 呼び出しを避けるためにも依存先は補正後の値に統一する。
- **`onVisited` / `onExclude` はプリロードの恩恵を最も受けやすい操作であることに注意する。** 既視聴・除外にすると `current` は `useFeed()` の再計算で feed から除外されるため、多くの場合「同じ `index` が自動的に旧 `preloadNext` を指す」状態になる（`next()` を呼ばなくても実質的に次の配信へ進む）。この遷移時に preload 済みスロットがそのまま `active` へ昇格できることを M3 の検証で重点的に確認する。
- `source` 切替、検索実行、デモ切替など「チャンネル集合が大きく変わる」操作では、リセットしてよい。ただし、実装上は `poolResetKey` のような明示的キーで行い、通常の feed 配列再生成と区別する。
- `feed.length` が0になったら、全スロットをミュートして idle にする。可能なら pause する。スロットの div コンテナは DOM に残し、検索条件クリアなどの一時的な空状態から復帰した時に既存インスタンスを再利用できるようにする。
- 空状態ではプレイヤーコンテナを CSS でユーザーに見えない状態にする。ただし、Twitch embed 要件に抵触する隠し方を通常の preload 状態へ流用しない。空状態は pause 済みのため、preload の可視性検証とは別扱いにする。

### 4.4 CSS と可視性

初期案をそのまま採用しない。

検証対象の CSS 候補:

1. `visibility:hidden`
2. `opacity:0; pointer-events:none`
3. 画面内で最小要件を満たすが、active の下に重ねる
4. 画面外配置
5. `transform` で退避

採用条件:

- preload スロットが `READY` になる。
- preload スロットが `PLAYING` になる、または切り替え直後に十分短時間で再生へ入る。
- Twitch 側の autoplay/visibility エラーが出ない。
- active スロットと preload スロットの音が二重に鳴らない。
- ユーザー操作を active プレイヤーが阻害しない。
- Twitch embed 要件に反しない。

現在の実装には `.zap-player-overlay` は存在しない。あるのは `reclaimFocus()` によるフォーカス回収だけ。計画内で overlay を前提にしない。もしフォーカス遮断用 overlay を新規追加するなら、Twitch embed を覆うことによる autoplay/visibility への影響を検証対象に含める。

### 4.5 インスタンス生成とクリーンアップ

各スロットは「DOMコンテナ1つにつき `Twitch.Player` インスタンス1つ」を厳守する。

- script loader はモジュールスコープの Promise で共有し、複数回 script を追加しない。
- スロットごとに `playerRef` / `initialized` / `containerId` を保持する。
- すでにインスタンスが存在するスロットでは `new Twitch.Player()` を再実行しない。
- やむを得ず再初期化する場合は、先に `setMuted(true)`, `pause()` を試み、コンテナの子要素を明示的に空にしてから作り直す。
- React Strict Mode 相当の mount / cleanup / remount でも、同一コンテナに iframe が二重生成されないことを M2 で確認する。
- cleanup 後に古いイベントが来ても状態を更新しないよう、cleanup 時に slot token を無効化する。

## 5. 実装マイルストーン

### M0: ベースライン確認

目的: 現状のロード挙動と制約を記録する。

作業:

- `npm run build` が通ることを確認。
- `npm run dev` で `http://localhost:5173/dpgk.html` を開く。
- 実 Twitch ログイン状態で検索し、現在の iframe 実装で `next()` 時に iframe が作り直されることを Network / Elements で確認。
- `PLAYER_PARENT` が localhost と公開環境で妥当か確認。

完了条件:

- 現状の問題を再現できる。
- 比較用の観測ポイントを決める。

### M1: 実装前スパイク

目的: 「プリロードスロットを隠しても Twitch が再生・バッファするか」を確認する。

作業:

- 一時的な検証ページまたはブランチ上の最小実装で、2つの `Twitch.Player` を作る。
- 両方に `width: '100%'`, `height: '100%'`, `parent: [PLAYER_PARENT]` を指定する。video-only 相当の追加オプションは、利用する API の公式 option として確認できた場合だけ指定する。
- active は音声あり、preload は muted で開始する。
- CSS 候補ごとに、`READY`, `PLAYING`, `pause`, `play`, `setMuted`, `setChannel` の挙動を console に記録する。
- `getPlaybackStats()` が利用できる場合は buffer 関連の値も記録する。
- `setChannel()` 実行時に、どのイベントがどの順序で発火するかを初期化時と比較する。`READY` が再発火するか、別イベントだけで遷移するか、イベントなしで `getChannel()` / `getPlaybackStats()` だけが変わるかを記録する。
- `setChannel()` 後に `getPlaybackStats()`, `getVolume()`, `getMuted()`, `getQualities()` が新しいチャンネル状態に追従するか確認する。
- 非アクティブスロットで `setQuality()` による低画質化が可能か確認する。`160p30` などの候補が `getQualities()` に存在するか、画質変更がバッファリングや昇格速度へ悪影響を出さないかを見る。
- `getQualities()` が正しい新チャンネルの品質一覧を返すタイミングを確認する。`setChannel()` 直後、`READY`, `PLAYING`, その他イベント後で比較し、画質変更を実行してよいイベントを確定する。
- モバイルを対象環境に含める場合は、iOS Safari と Android Chrome の実機で muted preload が `PLAYING` に入るか確認する。モバイルで成立しない場合は、PC限定有効化または設定による opt-in に切り替える判断材料にする。
- Network で、切り替え時に「昇格するチャンネル」の初期ロードが新規発生しないか確認する。新しい `preloadNext` のロードが発生するのは正常。

完了条件:

- 採用可能な非アクティブスロット表示方式が1つ以上見つかる。
- `setChannel()` 後のイベント順序と状態取得方法が確定し、`usePlayerPool` の状態遷移を設計できる。
- 画質変更を実行してよいイベントタイミングが確定する。確定できない場合、画質制御は M2 から外して best-effort の後続タスクに回す。
- モバイル対応方針が決まる。PCのみ有効、モバイルでは無効、設定で切替、のいずれかを明文化する。
- 見つからない場合は M2 へ進まない。

### M2: 2スロット最小実装

目的: `next()` の主経路だけを改善する。

作業:

- `usePlayerPool(feed, index, options)` を新規作成。
- `DpgkApp.jsx` から `playerSrc` と動画 iframe を除去し、スロット div を描画する。
- embed script は hook 内で動的ロードする。`dpgk.html` へのグローバル script 追加は避ける。
- `current` がない時はプレイヤーをミュート/停止し、空状態 UI を維持する。
- `feed.length === 0` の空状態でもスロット div は残し、全プレイヤーをミュート/停止したうえで、復帰時に再利用できるようにする。
- active 昇格時は active だけ `setMuted(false)` にする。ただし、ブラウザまたは Twitch がミュート状態を復元する可能性があるため、`READY` 後にも意図した状態を書き込む。
- preload は必ず muted。
- `index` が高速で変化した場合、未完了の `setChannel()` や古いイベントが `assignmentToken` で破棄され、最終的な active login と音声出力が一致するようにする。
- 同一スロット内に iframe が複数生成されないよう、インスタンス化ガードと再初期化時のコンテナクリアを入れる。
- debug 用に `window.__dpgkPlayerPool` または開発時 console ログでスロット状態を確認できるようにする。恒久 UI は不要。

完了条件:

- `next()` 1回目で、プリロード済みなら active 切り替えが iframe 再生成より速い。
- 音声は常に1本だけ。
- 高速 `next()` 連打後も、最後の `index` に対応する login だけが active になり、古いイベントで状態が巻き戻らない。
- 各スロットのコンテナ内に Twitch iframe が1つだけ存在する。
- `prev()` は改善対象外でも壊れない。
- `npm run build` が通る。

### M3: feed 更新・操作統合

目的: DPGK の実操作でプールが破綻しないようにする。

作業:

- `onFavorite`, `onVisited`, `onExclude` 後の feed 再計算で、二重音声・空スロット・古い active が残らないことを確認。
- `switchSource()` と `handleSearch()` では、必要なら明示的な `poolResetKey` を増やす。
- `feed.length` が縮んで `index` が補正されるケースを確認する。
- `feed.length` が一時的に0になり、その後の検索や source 切替で復帰するケースを確認する。スロット div は維持され、iframe が不要に二重生成されないことを見る。
- `showChat` の切替でプレイヤースロットが再生成されないことを確認する。
- `reclaimFocus()` が複数 iframe でもキーボード操作を妨げないことを確認する。

完了条件:

- お気に入り、既視聴、除外、source 切替、検索再実行で例外が出ない。
- active login とメタ情報・チャット login が一致する。
- 操作後も次チャンネルの preload が再開される。

### M4: 任意の3スロット化

目的: `prev()` も軽くする。

実施条件:

- M2/M3 が安定している。
- CPU、メモリ、通信量が許容範囲。
- Twitch visibility/autoplay 制約を追加スロットでも満たせる。
- 非アクティブスロットの低画質化が安定している、または低画質化なしでも通信量が許容範囲。

作業:

- 直前 active を `warmPrev` として保持する。
- preloadNext / warmPrev には可能なら低画質を指定し、active 昇格時に通常画質へ戻す。画質値は `getQualities()` に存在するものだけ使う。
- 3スロット時の eviction 優先度を明文化する。
  1. wanted active は絶対保持。
  2. wanted preloadNext を優先。
  3. warmPrev は余裕がある時だけ保持。
- 高速連打時は warmPrev を捨ててよい。

完了条件:

- 1つ戻る操作がプリロード済みなら即時に近い。
- 3本同時再生による負荷が許容範囲。
- 低画質化によって active 昇格時の再生開始が遅くならない。
- 低画質→通常画質への切り替えが、再生開始の遅延だけでなく**見た目のチラつき・一瞬の画質低下**としても目立たない（"遅延しない"と"昇格直後に荒い画質が一瞬見える"は別問題であり、後者も確認対象に含める）。許容できない場合は、preload 中の低画質化自体を見送る（通常画質のまま先読みする）選択肢に倒す。

### M5: 仕上げ

作業:

- 不要な debug ログを削除または開発時限定にする。
- 設定に「プリロード ON/OFF」を追加するか判断する。モバイル回線や低スペック環境を考えると、将来的には `useSettings` 管理にする余地を残す。
- README または docs に検証結果を追記する。
- `npm run build` を最終確認する。

完了条件:

- 実 Twitch 環境で主操作が安定。
- known risks が文書化されている。

## 6. 検証ポイント

### 自動・静的確認

- `npm run build`
- ESLint が導入されていないため、現時点では build を最低ラインとする。
- スロット割り当てロジックは可能なら純関数に分け、手動で Node 実行できる形にする。

確認したい純関数ケース:

- `index=0`, feed 2件: active 0, preload 1。
- `next()` 後: 旧 preload が active へ昇格。
- feed 末尾: preload なし。
- current が feed から消える。
- source 切替で reset key が変わる。
- 同じスロットへ短時間に A -> B -> C と割り当てた時、A/B の古いイベントが C の状態を上書きしない。
- `getQualities()` に低画質候補がない場合、画質変更をスキップしても状態遷移が壊れない。

### ブラウザ確認

対象:

- `http://localhost:5173/dpgk.html`
- 実 Twitch ログイン状態
- `?demo=1` は DOM と状態遷移確認のみ。架空チャンネルが含まれるため映像評価には使わない。
- モバイル対応を掲げる場合は、iOS Safari と Android Chrome の実機。PC と同じ挙動を前提にしない。

見る場所:

- Elements: スロット div が固定数で、チャンネル切り替え時にコンテナごと作り直されない。
- Network: 昇格するチャンネルの初期ロードが切り替え瞬間に発生しない。新しい preloadNext のロードは発生してよい。
- Console: Twitch の autoplay/visibility/parent 関連エラーがない。
- Performance/Task Manager: 2スロット時、3スロット時の CPU/メモリが許容範囲。
- 実聴: 二重音声、無音固定、勝手なミュート復元がない。
- Console/debug: `setChannel()` 後のイベント順序、`assignmentToken`、各スロットの login/role/quality が期待通り。
- Elements: 各スロット内の Twitch iframe が常に1つだけ。
- Console/debug: `getQualities()` が空配列または旧チャンネルの品質一覧を返すタイミングで `setQuality()` を呼んでいない。

操作ケース:

- `ArrowDown` / 下ボタン / 上スワイプで next。
- `ArrowUp` / 前ボタン / 下スワイプで prev。
- `ArrowRight` お気に入り。
- `ArrowLeft` 既視聴。
- `Delete` 除外。
- 検索再実行。
- お気に入り/その他 source 切替。
- チャット表示 ON/OFF。
- feed 0件の空状態から検索・source 切替で復帰。
- 末尾・先頭での操作。
- 高速 next 連打。

## 7. 開発不能と判断する条件

次のいずれかに該当したら、この方式での実装を中止する。

- M1 で、Twitch embed 要件を満たしながら非アクティブスロットを再生・準備状態にできる CSS が見つからない。
- preload を成立させる唯一の方法が、Twitch embed を隠す、覆う、最小サイズ未満にするなど、公式要件に反する。
- muted autoplay が、主要環境で安定して開始できない。特にユーザー操作後でも preload が `PLAYING` に入らない。
- active 昇格時に、Twitch 側の状態復元やブラウザ制約により、音声あり再生を安定して実現できない。
- 2スロットだけで CPU/メモリ/通信量が明らかに過大で、通常利用に耐えない。
- 2スロットで `setChannel()` 後のイベント順序や状態取得が不安定で、active 判定やミュート制御を正しく確定できない。
- 高速 `index` 変更時に、token による破棄を入れても古いイベントで active やミュート状態が巻き戻る。
- 同一コンテナへの二重 iframe 生成を防げず、二重音声やメモリリークが再現する。
- 対象環境にモバイルを含める必要があるのに、iOS Safari / Android Chrome で muted preload が安定せず、PC限定化や設定無効化もプロダクト要件上許容できない。
- 複数プレイヤー起動が Twitch 側のエラー、制限、または埋め込み利用上の問題を継続的に引き起こす。
- 実装が DPGK の主要操作、特に既視聴・除外・お気に入りによる feed 更新と両立しない。

中止時の代替案:

- プリロードは諦め、単一 `Twitch.Player` の `setChannel()` 移行だけを検討する。
- 切り替え直後のローディング表示やメタ情報先行表示で体感を改善する。
- ユーザー設定で明示的に「高負荷プリロード」を opt-in にする案を別計画に分ける。

## 8. 既知リスク

- 裏で再生される preload は通信量と CPU を消費する。
- `setQuality()` で低画質化できる場合でも、Twitch 側の利用可能品質は配信ごとに異なり、常に `160p30` が存在するとは限らない。
- preload中に低画質化した場合、active昇格時に通常画質へ戻す切り替えが、遅延はなくても一瞬の画質低下・チラつきとして視認される可能性がある（M4完了条件参照）。
- 裏プレイヤーが Twitch の視聴セッションとして扱われ、視聴者数に影響する可能性がある。
- Twitch embed の autoplay / visibility 判定は変更される可能性がある。
- モバイルブラウザでは autoplay がより厳しく、同じ体験にならない可能性がある。
- iOS Safari などでは inline playback や複数動画の同時バッファリングに追加制約があるため、PCで成功してもモバイルで失敗する可能性がある。
- プレイヤー内部 iframe の console error は完全には制御できない。アプリ側に影響するエラーと、iframe 内部だけのノイズを切り分ける必要がある。

## 9. 実装メモ

- hook 内の script loader は Promise をモジュールスコープで共有し、複数回 script を追加しない。
- React Strict Mode 相当の二重 mount に耐えるよう、生成済みチェック、コンテナ内 iframe 数の確認、cleanup を入れる。
- `Twitch.Player` に公式な destroy が利用できない場合、unmount 時はミュート・pause 後にコンテナ中身を空にする。
- player event listener は slot ごとに管理し、古い login のイベントが新しい login の状態を上書きしないよう、assignment token を持つ。`setChannel()` のたびに token を増やし、イベント処理前に現在 token と一致するか確認する。
- 画質制御は best-effort とする。preload は `getQualities()` に存在する最も低い品質、active は `chunked` または自動相当が存在する場合だけ指定する。存在しない場合は Twitch 側の既定値へ任せる。`getQualities()` は `setChannel()` 直後に信用せず、M1で確定したイベント以後かつ token 一致時にだけ読む。
- 空 feed ではスロット div を残し、全プレイヤーをミュート/停止する。空状態の非表示 CSS は preload の可視性要件とは別扱いにし、再生中の preload に流用しない。
- active とチャット iframe は同じ `current.user_login` を参照する。プレイヤー側の昇格が遅れても、メタ情報だけが先にズレて見えないようロード中表示を検討する。
- `useZapControls` には `onPlayPause` / `onMute` の余地があるが、現 DPGK UI では未接続。今回の最小実装では必須にしない。
- 旧 `docs/dpgk-tasks/` は `useTwitchPlayer.js` と `.zap-player-overlay` を前提にしており、現在のコードとはずれている。必要な情報だけ参照し、前提をそのまま持ち込まない。
