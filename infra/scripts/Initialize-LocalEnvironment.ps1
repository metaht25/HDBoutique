$ErrorActionPreference = 'Stop'

$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$environmentPath = Join-Path $projectRoot '.env.docker'
if (Test-Path -LiteralPath $environmentPath) {
    Write-Output '.env.docker ya existe; se conserva sin cambios.'
    return
}

function New-LocalPassword {
    $randomBytes = New-Object byte[] 32
    $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $generator.GetBytes($randomBytes)
        return [BitConverter]::ToString($randomBytes).Replace('-', '').ToLowerInvariant()
    }
    finally {
        $generator.Dispose()
    }
}

$template = [IO.File]::ReadAllText((Join-Path $projectRoot '.env.docker.example'))
$template = $template.Replace('POSTGRES_PASSWORD=', ('POSTGRES_PASSWORD=' + (New-LocalPassword)))
$template = $template.Replace('HDB_DATABASE_PASSWORD=', ('HDB_DATABASE_PASSWORD=' + (New-LocalPassword)))
$encoding = New-Object Text.UTF8Encoding $false
# CreateNew impide sobrescribir incluso si otro proceso creo el archivo entretanto.
$stream = [IO.File]::Open($environmentPath, [IO.FileMode]::CreateNew)
try {
    $bytes = $encoding.GetBytes($template)
    $stream.Write($bytes, 0, $bytes.Length)
}
finally {
    $stream.Dispose()
}
Write-Output '.env.docker creado con dos claves aleatorias. No compartir ni versionar.'
