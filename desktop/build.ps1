$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$sdk = Join-Path $root "tools\webview2-sdk"
$out = Join-Path $PSScriptRoot "build\ReadTree"
$csc = Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"

if (-not (Test-Path $csc)) { throw "csc.exe not found: $csc" }
if (-not (Test-Path $sdk)) { throw "WebView2 SDK not found: $sdk" }

Push-Location $root
try {
    pnpm build
    New-Item -ItemType Directory -Force -Path $out | Out-Null

    $cscArgs = @(
        "/nologo",
        "/target:winexe",
        "/platform:x64",
        "/codepage:65001",
        "/out:$out\ReadTree.exe",
        "/win32icon:$PSScriptRoot\ReadTree.ico",
        "/resource:$root\dist\index.html,ReadTree.app.html",
        "/r:System.dll",
        "/r:System.Core.dll",
        "/r:System.Drawing.dll",
        "/r:System.Windows.Forms.dll",
        "/r:System.Web.Extensions.dll",
        "/r:$sdk\lib\net462\Microsoft.Web.WebView2.Core.dll",
        "/r:$sdk\lib\net462\Microsoft.Web.WebView2.WinForms.dll",
        "$PSScriptRoot\Program.cs",
        "$PSScriptRoot\AssemblyInfo.cs"
    )

    & $csc $cscArgs

    Copy-Item "$sdk\lib\net462\Microsoft.Web.WebView2.Core.dll" $out -Force
    Copy-Item "$sdk\lib\net462\Microsoft.Web.WebView2.WinForms.dll" $out -Force
    Copy-Item "$sdk\runtimes\win-x64\native\WebView2Loader.dll" $out -Force
}
finally {
    Pop-Location
}

Write-Host "Built: $out\ReadTree.exe"
