
<#
一键构建 admin 前端并启动 docker-compose（支持 docker-compose 或 docker compose）
用法：在项目根目录以管理员身份运行：
  .\scripts\dev-compose.ps1
可选参数：-SkipFrontend 跳过前端构建（仅启动容器）
#>

param(
    [switch]$SkipFrontend
)

Set-StrictMode -Version Latest

$root = Resolve-Path "$(Split-Path -Parent $MyInvocation.MyCommand.Path)\.."
Write-Host "项目根目录： $root"

if (-not $SkipFrontend) {
    $adminDir = Join-Path $root 'backend\admin-vite'
    if (-not (Test-Path $adminDir)) {
        Write-Host "未找到 admin 前端目录： $adminDir" -ForegroundColor Red
        exit 1
    }
    Push-Location $adminDir
    try {
        Write-Host "安装前端依赖 (npm ci)..."
        npm ci
        Write-Host "构建前端 (npm run build)..."
        npm run build
    }
    catch {
        Write-Host "前端构建失败： $_" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    Pop-Location
}

# 选择 docker-compose 命令（兼容老/new 语法）
if (Get-Command docker-compose -ErrorAction SilentlyContinue) {
    $cmd = 'docker-compose'
    $args = @('-f','docker-compose.yml','-f','docker-compose.override.yml','up','--build','-d')
}
else {
    $cmd = 'docker'
    $args = @('compose','-f','docker-compose.yml','-f','docker-compose.override.yml','up','--build','-d')
}

Write-Host "执行: $cmd $($args -join ' ')"
$process = Start-Process -FilePath $cmd -ArgumentList $args -NoNewWindow -Wait -PassThru -RedirectStandardOutput "$root\scripts\dev-compose.log" -RedirectStandardError "$root\scripts\dev-compose.err"

if ($process.ExitCode -ne 0) {
    Write-Host "docker compose 运行失败，查看 scripts\dev-compose.err" -ForegroundColor Red
    exit $process.ExitCode
}

Write-Host "docker compose 执行完成，容器已启动（后台）。"
Write-Host "日志: $root\scripts\dev-compose.log"
<#
一键构建 admin 前端并启动 docker-compose（支持 docker-compose 或 docker compose）
用法：在项目根目录以管理员身份运行：
  .\scripts\dev-compose.ps1
可选参数：-SkipFrontend 跳过前端构建（仅启动容器）
#>

param(
    [switch]$SkipFrontend
)

Set-StrictMode -Version Latest

$root = Split-Path -Parent $MyInvocation.MyCommand.Path | Resolve-Path
Write-Host "项目根目录： $root"

if (-not $SkipFrontend) {
    $adminDir = Join-Path $root 'backend\admin-vite'
    if (-not (Test-Path $adminDir)) {
        Write-Host "未找到 admin 前端目录： $adminDir" -ForegroundColor Red
        exit 1
    }
    Push-Location $adminDir
    try {
        Write-Host "安装前端依赖 (npm ci)..."
        npm ci
        Write-Host "构建前端 (npm run build)..."
        npm run build
    }
    catch {
        Write-Host "前端构建失败： $_" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    Pop-Location
}

# 选择 docker-compose 命令（兼容老/new 语法）
if (Get-Command docker-compose -ErrorAction SilentlyContinue) {
    $cmd = 'docker-compose'
    $args = @('-f','docker-compose.yml','-f','docker-compose.override.yml','up','--build','-d')
}
else {
    $cmd = 'docker'
    $args = @('compose','-f','docker-compose.yml','-f','docker-compose.override.yml','up','--build','-d')
}

Write-Host "执行: $cmd $($args -join ' ')"
$process = Start-Process -FilePath $cmd -ArgumentList $args -NoNewWindow -Wait -PassThru -RedirectStandardOutput "$root\scripts\dev-compose.log" -RedirectStandardError "$root\scripts\dev-compose.err"

if ($process.ExitCode -ne 0) {
    Write-Host "docker compose 运行失败，查看 scripts\dev-compose.err" -ForegroundColor Red
    exit $process.ExitCode
}

Write-Host "docker compose 执行完成，容器已启动（后台）。"
Write-Host "日志: $root\scripts\dev-compose.log"
<#
一键构建 admin 前端并启动 docker-compose（支持 docker-compose 或 docker compose）
用法：在项目根目录以管理员身份运行：
  .\scripts\dev-compose.ps1
可选参数：-SkipFrontend 跳过前端构建（仅启动容器）
#>

param(
    [switch]$SkipFrontend
)

Set-StrictMode -Version Latest

$root = Split-Path -Parent $MyInvocation.MyCommand.Path | Resolve-Path
Write-Host "项目根目录： $root"

if (-not $SkipFrontend) {
    $adminDir = Join-Path $root 'backend\admin-vite'
    if (-not (Test-Path $adminDir)) {
        Write-Host "未找到 admin 前端目录： $adminDir" -ForegroundColor Red
        exit 1
    }
    Push-Location $adminDir
    try {
        Write-Host "安装前端依赖 (npm ci)..."
        npm ci
        Write-Host "构建前端 (npm run build)..."
        npm run build
    }
    catch {
        Write-Host "前端构建失败： $_" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    Pop-Location
}

# 选择 docker-compose 命令（兼容老/new 语法）
if (Get-Command docker-compose -ErrorAction SilentlyContinue) {
    $cmd = 'docker-compose'
    $args = @('-f','docker-compose.yml','-f','docker-compose.override.yml','up','--build','-d')
}
else {
    $cmd = 'docker'
    $args = @('compose','-f','docker-compose.yml','-f','docker-compose.override.yml','up','--build','-d')
}

Write-Host "执行: $cmd $($args -join ' ')"
$process = Start-Process -FilePath $cmd -ArgumentList $args -NoNewWindow -Wait -PassThru -RedirectStandardOutput "$root\scripts\dev-compose.log" -RedirectStandardError "$root\scripts\dev-compose.err"

if ($process.ExitCode -ne 0) {
    Write-Host "docker compose 运行失败，查看 scripts\dev-compose.err" -ForegroundColor Red
    exit $process.ExitCode
}

Write-Host "docker compose 执行完成，容器已启动（后台）。"
Write-Host "日志: $root\scripts\dev-compose.log"
