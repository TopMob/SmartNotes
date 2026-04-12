@echo off
setlocal EnableExtensions EnableDelayedExpansion
set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "ROOT_DIR=%%~fI"
set "IMAGE_DIR=%ROOT_DIR%\image"
set "FONT_DIR=%ROOT_DIR%\assets\fonts"
set "CSS_DIR=%ROOT_DIR%\css"
if not exist "%IMAGE_DIR%" mkdir "%IMAGE_DIR%"
if not exist "%FONT_DIR%" mkdir "%FONT_DIR%"
if not exist "%CSS_DIR%" mkdir "%CSS_DIR%"

call :copyFirst "logo*.png" "Logo.png"
call :copyFirst "logo*.jpg" "Logo.png"
call :copyFirst "favicon*.ico" "favicon.ico"
call :copyFirst "favicon*.png" "favicon.ico"
call :copyFirst "apple*icon*.png" "apple-touch-icon.png"
call :copyFirst "splash*.png" "splash.png"

if not exist "%ROOT_DIR%\Logo.png" if exist "%IMAGE_DIR%\Logo.png" copy /Y "%IMAGE_DIR%\Logo.png" "%ROOT_DIR%\Logo.png" >nul
if not exist "%ROOT_DIR%\favicon.ico" if exist "%IMAGE_DIR%\favicon.ico" copy /Y "%IMAGE_DIR%\favicon.ico" "%ROOT_DIR%\favicon.ico" >nul
if not exist "%ROOT_DIR%\apple-touch-icon.png" if exist "%IMAGE_DIR%\apple-touch-icon.png" copy /Y "%IMAGE_DIR%\apple-touch-icon.png" "%ROOT_DIR%\apple-touch-icon.png" >nul

set "GOOGLE_CSS_URL=https://fonts.googleapis.com/icon?family=Material+Icons+Round"
set "TEMP_CSS=%TEMP%\material_icons_round_source.css"
set "FONT_FILE=%FONT_DIR%\material-icons-round.woff2"

powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -UseBasicParsing -Uri '%GOOGLE_CSS_URL%' -OutFile '%TEMP_CSS%'"
if errorlevel 1 (
    echo failed to download icon css
    exit /b 1
)

for /f "usebackq delims=" %%U in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$css = Get-Content -Raw '%TEMP_CSS%'; $m = [regex]::Match($css, 'url\((https:[^)]+\.woff2)\)'); if($m.Success){$m.Groups[1].Value}"`) do set "FONT_URL=%%U"
if "%FONT_URL%"=="" (
    echo failed to parse font url
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -UseBasicParsing -Uri '%FONT_URL%' -OutFile '%FONT_FILE%'"
if errorlevel 1 (
    echo failed to download font file
    exit /b 1
)

(
    echo @font-face {
    echo     font-family: "Material Icons Round";
    echo     font-style: normal;
    echo     font-weight: 400;
    echo     src: url("../assets/fonts/material-icons-round.woff2") format("woff2");
    echo }
    echo.
    echo .material-icons-round {
    echo     font-family: "Material Icons Round";
    echo     font-weight: 400;
    echo     font-style: normal;
    echo     font-size: 24px;
    echo     line-height: 1;
    echo     letter-spacing: normal;
    echo     text-transform: none;
    echo     display: inline-block;
    echo     white-space: nowrap;
    echo     word-wrap: normal;
    echo     direction: ltr;
    echo     font-feature-settings: "liga";
    echo     -webkit-font-feature-settings: "liga";
    echo     -webkit-font-smoothing: antialiased;
    echo }
) > "%CSS_DIR%\local-icons.css"

echo assets prepared successfully
exit /b 0

:copyFirst
set "PATTERN=%~1"
set "TARGET=%~2"
for %%F in ("%IMAGE_DIR%\%PATTERN%") do (
    if exist "%%~fF" (
        copy /Y "%%~fF" "%ROOT_DIR%\%TARGET%" >nul
        echo copied %%~nxF to %TARGET%
        goto :eof
    )
)
goto :eof
