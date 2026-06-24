@echo off
title OnomaPet 00 Live Demo Server
echo ===================================================
echo  OnomaPet 00 - Local Server Launcher
echo ===================================================
echo.
echo  1. Starting local Python web server on port 8000...
echo  2. Opening http://localhost:8000/demo.html in your browser...
echo.
echo  (To stop the server, close this command window)
echo.
echo ===================================================

:: Open default browser
start "" "http://localhost:8000/demo.html"

:: Start Python HTTP Server
python -m http.server 8000
