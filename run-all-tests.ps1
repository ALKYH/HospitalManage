<#
.SYNOPSIS
  在仓库中递归查找含 `test` 脚本的 `package.json` 并顺序执行 `npm test`。

.NOTES
  用法: 在项目根目录双击或通过 PowerShell 运行: `./run-all-tests.ps1`
  如果任何一个子包测试失败，脚本会终止并返回非零退出码。
#>

[CmdletBinding()]
param(
    [switch]$ContinueOnFail
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
Write-Host "Repository root: $root"

# Find all package.json files
$packageFiles = Get-ChildItem -Path $root -Recurse -Filter package.json -File -ErrorAction SilentlyContinue
if (-not $packageFiles) {
    Write-Host "No package.json files found." -ForegroundColor Yellow
    exit 0
}

$failed = $false
foreach ($pkg in $packageFiles) {
    try {
        $json = Get-Content $pkg.FullName -Raw | ConvertFrom-Json
    } catch {
        Write-Host "Failed to parse $($pkg.FullName), skipping." -ForegroundColor Yellow
        continue
    }

    if ($json.scripts -and $json.scripts.test) {
        $dir = $pkg.Directory.FullName
        Write-Host "=== Running tests in: $dir ===" -ForegroundColor Cyan
        npm --prefix "$dir" test
        $rc = $LASTEXITCODE
        if ($rc -ne 0) {
            Write-Host "Tests failed in $dir (exit $rc)" -ForegroundColor Red
            $failed = $true
            if (-not $ContinueOnFail) { break }
        }
    }
}

if ($failed) {
    Write-Host "One or more test suites failed." -ForegroundColor Red
    exit 1
} else {
    Write-Host "All discovered tests completed successfully." -ForegroundColor Green
    exit 0
}
