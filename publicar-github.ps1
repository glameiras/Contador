# Execute APÓS criar um repositório vazio chamado "Contador" no GitHub.
# Em VS Code: Terminal > New Terminal (PowerShell) > .\publicar-github.ps1
# Use os próprios prompts de autenticação do GitHub; não cole tokens no script.
$ErrorActionPreference = 'Stop'
$repo = 'https://github.com/glameiras/Contador.git'
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Error 'Git não encontrado. Instale o Git for Windows antes de continuar.'
  exit 1
}
if (-not (Test-Path './index.html')) {
  Write-Error 'Execute este script dentro da pasta Contador, que contém index.html.'
  exit 1
}
if (-not (Test-Path './.git')) { git init }
git add index.html css js supabase README.md .gitignore publicar-github.ps1
$changes = git status --porcelain
if ($changes) {
  git commit -m 'feat: Contador com dashboard, auth Supabase e RLS'
}
git branch -M main
$origin = git remote get-url origin 2>$null
if ($LASTEXITCODE -ne 0) {
  git remote add origin $repo
} elseif ($origin -ne $repo) {
  Write-Error "O remote origin atual aponta para $origin. Revise antes de alterar."
  exit 1
}
git push -u origin main
if ($LASTEXITCODE -ne 0) {
  Write-Error 'Falha ao enviar. Confirme que glameiras/Contador já existe e que você autenticou o Git.'
  exit 1
}
Write-Host "Pronto! https://github.com/glameiras/Contador"
