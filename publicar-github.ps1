# Opcional: publicar atualizações a partir do VS Code no Windows.
$ErrorActionPreference = 'Stop'
$repo = 'https://github.com/glameiras/Contador.git'
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Instale o Git for Windows.' }
if (-not (Test-Path './index.html')) { throw 'Execute dentro da pasta Contador.' }
if (-not (Test-Path './.git')) { git init }
git add index.html css js supabase README.md .gitignore publicar-github.ps1
if (git status --porcelain) { git commit -m 'atualiza: Contador' }
git branch -M main
$origin = git remote get-url origin 2>$null
if ($LASTEXITCODE -ne 0) { git remote add origin $repo }
elseif ($origin -ne $repo) { throw "Confira origin: $origin" }
git pull --rebase origin main
git push -u origin main
