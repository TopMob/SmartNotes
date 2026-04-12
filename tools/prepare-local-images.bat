@echo off
setlocal EnableExtensions EnableDelayedExpansion
set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "ROOT_DIR=%%~fI"
set "IMAGE_DIR=%ROOT_DIR%\image"
if not exist "%IMAGE_DIR%" (
    echo image folder not found: "%IMAGE_DIR%"
    exit /b 1
)

call :copyFirst "logo*.png" "Logo.png"
call :copyFirst "logo*.jpg" "Logo.png"
call :copyFirst "favicon*.ico" "favicon.ico"
call :copyFirst "favicon*.png" "favicon.ico"
call :copyFirst "apple*icon*.png" "apple-touch-icon.png"
call :copyFirst "splash*.png" "splash.png"

if not exist "%ROOT_DIR%\Logo.png" if exist "%IMAGE_DIR%\Logo.png" copy /Y "%IMAGE_DIR%\Logo.png" "%ROOT_DIR%\Logo.png" >nul
if not exist "%ROOT_DIR%\favicon.ico" if exist "%IMAGE_DIR%\favicon.ico" copy /Y "%IMAGE_DIR%\favicon.ico" "%ROOT_DIR%\favicon.ico" >nul
if not exist "%ROOT_DIR%\apple-touch-icon.png" if exist "%IMAGE_DIR%\apple-touch-icon.png" copy /Y "%IMAGE_DIR%\apple-touch-icon.png" "%ROOT_DIR%\apple-touch-icon.png" >nul

echo Local image preparation completed.
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
