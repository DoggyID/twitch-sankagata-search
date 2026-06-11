# Twitch ライブ配信検索 — ローカル起動スクリプト
# ダブルクリック、または PowerShell で  .\起動.ps1  と実行してください。

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

Write-Host '=== Twitch ライブ配信検索 ローカル起動 ===' -ForegroundColor Magenta

# Node.js の確認
try {
    $nodeVersion = node --version
    Write-Host "Node.js: $nodeVersion" -ForegroundColor DarkGray
} catch {
    Write-Host 'Node.js が見つかりません。https://nodejs.org/ からインストールしてください。' -ForegroundColor Red
    Read-Host 'Enter キーで終了'
    exit 1
}

# 依存関係のインストール（初回のみ）
if (-not (Test-Path 'node_modules')) {
    Write-Host '依存関係をインストール中... (初回のみ・少し時間がかかります)' -ForegroundColor Yellow
    npm install
}

# デモモードのURL（認証不要で表示確認できる）
$demoUrl = 'http://localhost:5173/?demo=1'
Write-Host ''
Write-Host "起動後、ブラウザで次を開きます: $demoUrl" -ForegroundColor Green
Write-Host '（実データを使う場合は http://localhost:5173/ から Twitch 認証）' -ForegroundColor DarkGray
Write-Host '終了するには、このウィンドウで Ctrl+C を押してください。' -ForegroundColor DarkGray
Write-Host ''

# 3秒後にブラウザを開く（サーバー起動を待つ）
Start-Job -ScriptBlock {
    param($url)
    Start-Sleep -Seconds 3
    Start-Process $url
} -ArgumentList $demoUrl | Out-Null

# Vite 開発サーバーを起動（フォアグラウンド）
npm run dev
