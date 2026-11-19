@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================
echo  Pokedex Clone - servidor local
echo  http://127.0.0.1:8787
echo ============================================
echo.

if not exist "data\pokemon_index.json" (
  echo [!] No hay datos. Ejecutando scraper (puede tardar varios minutos)...
  python scrape_pokedex.py
  if errorlevel 1 (
    echo Error al scrapear. Revisa la conexion e intenta: python scrape_pokedex.py
    pause
    exit /b 1
  )
)

for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":8787" ^| findstr "LISTENING"') do (
  taskkill /F /PID %%a >nul 2>&1
)

start "Pokedex-Server" /min python -m http.server 8787
timeout /t 2 /nobreak >nul
start "" http://127.0.0.1:8787/index.html

echo Abierto. Deja la ventana del servidor minimizada.
pause
