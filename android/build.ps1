param(
    [string]$SdkRoot = $(if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { $env:ANDROID_SDK_ROOT }),
    [string]$JdkRoot = $env:JAVA_HOME
)

$ErrorActionPreference = 'Stop'

function Invoke-BuildTool {
    param([string]$Tool, [string[]]$ToolArgs)
    & $Tool @ToolArgs
    if ($LASTEXITCODE -ne 0) {
        throw "$(Split-Path -Leaf $Tool) exited with code $LASTEXITCODE."
    }
}

if (-not $SdkRoot) { throw 'Set ANDROID_HOME to your Android SDK directory.' }
if (-not $JdkRoot) { throw 'Set JAVA_HOME to your JDK directory.' }

$buildTools = Join-Path $SdkRoot 'build-tools/36.0.0'
$platform = Join-Path $SdkRoot 'platforms/android-36/android.jar'
$aapt = Join-Path $buildTools 'aapt2.exe'
$d8 = Join-Path $buildTools 'd8.bat'
$align = Join-Path $buildTools 'zipalign.exe'
$signer = Join-Path $buildTools 'apksigner.bat'
$javac = Join-Path $JdkRoot 'bin/javac.exe'
$jar = Join-Path $JdkRoot 'bin/jar.exe'
$keytool = Join-Path $JdkRoot 'bin/keytool.exe'
foreach ($toolPath in @($platform, $aapt, $d8, $align, $signer, $javac, $jar, $keytool)) {
    if (-not (Test-Path -LiteralPath $toolPath -PathType Leaf)) { throw "Missing SDK or JDK file: $toolPath" }
}

$outputDir = (New-Item -ItemType Directory -Path (Join-Path $PSScriptRoot 'build') -Force).FullName
$workDir = (New-Item -ItemType Directory -Path (Join-Path $outputDir ('work-' + [Guid]::NewGuid().ToString('N')))).FullName
$previousJavaHome = $env:JAVA_HOME
$env:JAVA_HOME = $JdkRoot

try {
    $generated = (New-Item -ItemType Directory -Path (Join-Path $workDir 'generated')).FullName
    $classes = (New-Item -ItemType Directory -Path (Join-Path $workDir 'classes')).FullName
    $dex = (New-Item -ItemType Directory -Path (Join-Path $workDir 'dex')).FullName
    $resources = Join-Path $workDir 'resources.zip'
    $classJar = Join-Path $workDir 'classes.jar'
    $unsigned = Join-Path $workDir 'unsigned.apk'
    $aligned = Join-Path $workDir 'aligned.apk'
    $signed = Join-Path $workDir 'signed.apk'
    $key = Join-Path $outputDir 'jodo-test.keystore'

    Invoke-BuildTool $aapt @('compile', '--dir', (Join-Path $PSScriptRoot 'res'), '-o', $resources)
    Invoke-BuildTool $aapt @('link', '-I', $platform, '--manifest', (Join-Path $PSScriptRoot 'AndroidManifest.xml'), '--java', $generated, '-o', $unsigned, $resources)
    Invoke-BuildTool $javac @('--release', '8', '-Xlint:-options', '-classpath', $platform, '-d', $classes, (Join-Path $PSScriptRoot 'src/com/jodo/demo/MainActivity.java'), (Join-Path $generated 'com/jodo/demo/R.java'))
    Invoke-BuildTool $jar @('cf', $classJar, '-C', $classes, '.')
    Invoke-BuildTool $d8 @('--lib', $platform, '--min-api', '23', '--output', $dex, $classJar)
    Invoke-BuildTool $jar @('uf', $unsigned, '-C', $dex, 'classes.dex')
    Invoke-BuildTool $align @('-f', '4', $unsigned, $aligned)

    if (-not (Test-Path -LiteralPath $key -PathType Leaf)) {
        Invoke-BuildTool $keytool @('-genkeypair', '-keystore', $key, '-storepass', 'android', '-keypass', 'android', '-alias', 'jodo-test', '-dname', 'CN=JODO Android Test', '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000')
    }
    Invoke-BuildTool $signer @('sign', '--ks', $key, '--ks-pass', 'pass:android', '--key-pass', 'pass:android', '--ks-key-alias', 'jodo-test', '--out', $signed, $aligned)
    Invoke-BuildTool $signer @('verify', '--verbose', $signed)
    Invoke-BuildTool $align @('-c', '4', $signed)

    $apk = Join-Path $outputDir 'JODO.apk'
    Move-Item -LiteralPath $signed -Destination $apk -Force
    Write-Output "Built $apk"
} finally {
    $env:JAVA_HOME = $previousJavaHome
    $resolved = (Get-Item -LiteralPath $workDir).FullName
    if ($resolved.StartsWith($outputDir + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        Remove-Item -LiteralPath $resolved -Recurse -Force
    }
}
