@echo off
cd /d C:\Users\kevin\Documents\digy\wsmikrowisp
set HEADLESS=true

REM Crear nombre de archivo de log con fecha
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set logfile=logs\scheduled-run-%datetime:~0,8%-%datetime:~8,6%.log

echo ========================================== >> %logfile%
echo Ejecucion programada iniciada: %date% %time% >> %logfile%
echo ========================================== >> %logfile%

call npm run transacciones >> %logfile% 2>&1

echo ========================================== >> %logfile%
echo Ejecucion completada: %date% %time% >> %logfile%
echo ========================================== >> %logfile%
