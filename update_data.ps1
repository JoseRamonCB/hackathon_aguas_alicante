param([switch]$Watch)

$CsvPath = Join-Path $PSScriptRoot "csv\2_resultados_riesgo_diario.csv"
$OutPath = Join-Path $PSScriptRoot "data.js"

function Build-DataJs {
    $ts = Get-Date -Format "HH:mm:ss"
    Write-Host "[$ts] Procesando CSV..."

    if (-not (Test-Path $CsvPath)) {
        Write-Host "  ERROR: No se encuentra $CsvPath"
        return $false
    }

    $csv = Import-Csv $CsvPath -Delimiter ";"
    $output = [ordered]@{}

    # Contratos
    $output["contratos"] = @($csv | Group-Object ID_Contrato | ForEach-Object {
        @{ id = $_.Name; region = $_.Group[0].Region; perfil = $_.Group[0].Perfil }
    })

    # Listas unicas
    $output["regiones"] = @($csv | Select-Object -ExpandProperty Region -Unique | Sort-Object)
    $output["perfiles"] = @($csv | Select-Object -ExpandProperty Perfil -Unique | Sort-Object)

    # Evolucion mensual por contrato
    $evolucionMensual = [ordered]@{}
    $csv | Group-Object ID_Contrato | ForEach-Object {
        $cid = $_.Name
        $meses = $_.Group | Group-Object { $_.Fecha.Substring(0,7) } | Sort-Object Name
        $evolucionMensual[$cid] = @($meses | ForEach-Object {
            $g = $_.Group
            $avg = { param($key) [Math]::Round(($g | ForEach-Object { [double]($_.$key -replace ',','.') } | Measure-Object -Average).Average, 2) }
            @{
                mes = $_.Name
                P1  = & $avg "P1_Ciclos"
                P2  = & $avg "P2_Osmosis"
                P3  = & $avg "P3_Perpetua"
                P4  = & $avg "P4_Enganche"
                P5  = & $avg "P5_Fuga"
                P6  = & $avg "P6_Electrico"
                RT  = [Math]::Round(($g | ForEach-Object { [double]($_."Riesgo_Total_%" -replace ',','.') } | Measure-Object -Average).Average, 2)
            }
        })
    }
    $output["evolucionMensual"] = $evolucionMensual

    # Riesgo por contrato (para heatmap global)
    $output["riesgoPorContrato"] = @($csv | Group-Object ID_Contrato | ForEach-Object {
        $vals = $_.Group | ForEach-Object { [double]($_."Riesgo_Total_%" -replace ',','.') }
        @{
            id     = $_.Name
            region = $_.Group[0].Region
            perfil = $_.Group[0].Perfil
            avg    = [Math]::Round(($vals | Measure-Object -Average).Average, 2)
            max    = [Math]::Round(($vals | Measure-Object -Maximum).Maximum, 2)
        }
    })

    # Riesgo por region
    $output["riesgoPorRegion"] = @($csv | Group-Object Region | ForEach-Object {
        $vals = $_.Group | ForEach-Object { [double]($_."Riesgo_Total_%" -replace ',','.') }
        @{ region = $_.Name; avg = [Math]::Round(($vals | Measure-Object -Average).Average, 2) }
    })

    # Guardar como variable JS (sin fetch, funciona con file://)
    $json = $output | ConvertTo-Json -Depth 10 -Compress
    $content = "const AQUADETECT_DATA = $json;"
    [System.IO.File]::WriteAllText($OutPath, $content, [System.Text.Encoding]::UTF8)

    $kb = [Math]::Round((Get-Item $OutPath).Length / 1KB, 1)
    Write-Host "  OK: data.js actualizado ($kb KB) con $($csv.Count) registros"
    return $true
}

# Ejecutar una vez
$ok = Build-DataJs

if ($Watch -and $ok) {
    Write-Host ""
    Write-Host "Watcher activo. Monitorizando: $CsvPath"
    Write-Host "Pulsa Ctrl+C para detener."
    Write-Host ""

    $watcher = New-Object System.IO.FileSystemWatcher
    $watcher.Path    = (Split-Path $CsvPath)
    $watcher.Filter  = (Split-Path $CsvPath -Leaf)
    $watcher.NotifyFilter = [System.IO.NotifyFilters]::LastWrite
    $watcher.EnableRaisingEvents = $true

    $lastRun = [DateTime]::MinValue
    while ($true) {
        $changed = $watcher.WaitForChanged([System.IO.WatcherChangeTypes]::Changed, 2000)
        if (-not $changed.TimedOut) {
            $now = Get-Date
            if (($now - $lastRun).TotalSeconds -ge 3) {
                $lastRun = $now
                Start-Sleep -Milliseconds 500
                Build-DataJs | Out-Null
            }
        }
    }
}
