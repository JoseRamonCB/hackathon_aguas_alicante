@echo off
echo.
echo  AquaDetect -- Lanzador
echo  Regenerando datos desde CSV...
echo.

powershell.exe -ExecutionPolicy Bypass -File "%~dp0update_data.ps1"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  [ERROR] No se pudo regenerar data.js
    echo  Revisa que exista: csv\2_resultados_riesgo_diario.csv
    pause
    exit /b 1
)

echo.
echo  Abriendo dashboard en el navegador...
start "" "%~dp0index.html"
echo  Dashboard abierto. Puedes cerrar esta ventana.
timeout /t 3 > nul
