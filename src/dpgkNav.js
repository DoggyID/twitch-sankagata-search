// メイン画面 ⇔ DPGKページ間のリンク先を、dev/本番どちらの base でも正しく解決する。
// dpgk.html と index.html は同階層に出力されるため、現在URL基準の相対解決でよい。

export function dpgkUrl({ demo = false } = {}) {
  const url = new URL('dpgk.html', window.location.href);
  if (demo) url.searchParams.set('demo', '1');
  return url.toString();
}

export function homeUrl({ demo = false } = {}) {
  const url = new URL('./', window.location.href);
  if (demo) url.searchParams.set('demo', '1');
  return url.toString();
}
