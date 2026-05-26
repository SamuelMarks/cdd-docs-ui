@echo off
setlocal

if /I "%1"=="docs" goto docs
echo Usage: make.bat docs
goto end

:docs
for %%I in (.) do set "PROJECT_NAME=%%~nxI"
call npx typedoc --skipErrorChecking --entryPointStrategy expand --out "docs\%PROJECT_NAME%" src

cd docs
if exist html rmdir /s /q html
if exist html del /Q html
mklink /J html "%PROJECT_NAME%"
cd ..

:end
endlocal
