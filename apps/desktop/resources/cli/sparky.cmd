@echo off
setlocal
set "ELECTRON_RUN_AS_NODE=1"
set "NODE_PATH=%~dp0..\app.asar.unpacked\node_modules;%~dp0..\app.asar\node_modules"
set "SPARKY_BIN_DIR=%~dp0..\bin"
"%~dp0..\..\Sparky.exe" --require "%~dp0lib\esm-resolve.cjs" "%~dp0lib\sparky.js" %*
