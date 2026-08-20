#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Empacota o Sistema PDV para Windows (instalador NSIS + ZIP portatil) localmente.

.DESCRIPTION
  Automatiza o build local do electron-builder aplicando os ajustes de ambiente
  descobertos no primeiro empacotamento (ver docs/build-release.md):
    - Garante Node/npm do sistema no PATH da sessao (instalacoes recentes nao
      aparecem em terminais abertos antes da instalacao).
    - Remove ELECTRON_RUN_AS_NODE (essa variavel faz o Electron travar).
    - Avisa se o Modo Desenvolvedor esta desligado (falha ao extrair o winCodeSign).
    - Avisa se o Smart App Control esta ligado (bloqueia o build NSIS: spawn UNKNOWN).
  Ao final, lista os artefatos gerados em release/.

.PARAMETER Install
  Roda 'npm ci' antes do build (reinstala dependencias do zero).

.PARAMETER ZipOnly
  Gera apenas o ZIP portatil, sem o passo NSIS. Util quando o Smart App Control
  esta ligado (o NSIS falharia).

.EXAMPLE
  ./scripts/package.ps1
  Gera instalador NSIS + ZIP em release/.

.EXAMPLE
  ./scripts/package.ps1 -Install -ZipOnly
  Reinstala dependencias e gera apenas o ZIP portatil.
#>
param(
  [switch]$Install,
  [switch]$ZipOnly
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

Write-Host "== Sistema PDV - empacotamento Windows ==" -ForegroundColor Cyan

# 1) PATH: garante o nodejs do sistema (util em terminais antigos)
$env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
            [System.Environment]::GetEnvironmentVariable('Path', 'User')

# 2) ELECTRON_RUN_AS_NODE quebra o Electron - remove da sessao
if ($env:ELECTRON_RUN_AS_NODE) {
  Remove-Item Env:ELECTRON_RUN_AS_NODE
  Write-Host "- ELECTRON_RUN_AS_NODE removido da sessao" -ForegroundColor Yellow
}

# 3) Node presente?
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js nao encontrado no PATH. Instale com 'winget install OpenJS.NodeJS.LTS' e reabra o terminal."
}
Write-Host "- Node $(node --version) / npm $(npm --version)"

# 4) Modo Desenvolvedor (necessario p/ extrair symlinks do winCodeSign sem admin)
$dev = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock' `
        -Name AllowDevelopmentWithoutDevLicense -ErrorAction SilentlyContinue).AllowDevelopmentWithoutDevLicense
if ($dev -ne 1) {
  Write-Host "! Modo Desenvolvedor DESLIGADO - o electron-builder pode falhar ao extrair o winCodeSign." -ForegroundColor Yellow
  Write-Host "  Ative em: Configuracoes > Sistema > Para desenvolvedores > Modo de desenvolvedor." -ForegroundColor Yellow
}

# 5) Smart App Control (bloqueia a execucao do stub NSIS nao assinado durante o build)
$sac = (Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\CI\Policy' `
        -Name VerifiedAndReputablePolicyState -ErrorAction SilentlyContinue).VerifiedAndReputablePolicyState
if ($sac -eq 1 -and -not $ZipOnly) {
  Write-Host "! Smart App Control LIGADO - o build do instalador NSIS vai falhar (spawn UNKNOWN)." -ForegroundColor Red
  Write-Host "  Alternativas: rode com -ZipOnly, gere via GitHub Actions, ou desligue o Smart App Control (irreversivel)." -ForegroundColor Red
}

# 6) Dependencias (opcional)
if ($Install) {
  Write-Host "- npm ci..."
  npm ci
}

# 7) Build
if ($ZipOnly) {
  Write-Host "- Gerando ZIP portatil (sem NSIS)..."
  npx electron-builder --win zip --publish never
}
else {
  Write-Host "- Gerando instalador NSIS + ZIP..."
  npm run build -- --publish never
}

# 8) Resultado
Write-Host "`n== Artefatos em release/ ==" -ForegroundColor Cyan
Get-ChildItem "$repo\release" -File -ErrorAction SilentlyContinue |
  Where-Object { $_.Extension -in '.exe', '.zip' } |
  Sort-Object Length -Descending |
  Select-Object Name, @{ n = 'MB'; e = { [math]::Round($_.Length / 1MB, 2) } } |
  Format-Table -AutoSize
