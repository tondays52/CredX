@echo off
set EDGE="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if not exist "d:\money\screenshots" mkdir "d:\money\screenshots"

echo Capturing Landing...
%EDGE% --headless=new --disable-gpu --screenshot="d:\money\screenshots\01_landing.png" --window-size=1440,900 --virtual-time-budget=4000 http://localhost:5173/#/landing

echo Capturing DePIN...
%EDGE% --headless=new --disable-gpu --screenshot="d:\money\screenshots\02_depin.png" --window-size=1440,900 --virtual-time-budget=4000 http://localhost:5173/#/depin

echo Capturing DeFi...
%EDGE% --headless=new --disable-gpu --screenshot="d:\money\screenshots\03_defi.png" --window-size=1440,900 --virtual-time-budget=4000 http://localhost:5173/#/defi

echo Capturing RWA...
%EDGE% --headless=new --disable-gpu --screenshot="d:\money\screenshots\04_rwa.png" --window-size=1440,900 --virtual-time-budget=4000 http://localhost:5173/#/rwa

echo Capturing AI...
%EDGE% --headless=new --disable-gpu --screenshot="d:\money\screenshots\05_ai.png" --window-size=1440,900 --virtual-time-budget=4000 http://localhost:5173/#/ai

echo Capturing Arena...
%EDGE% --headless=new --disable-gpu --screenshot="d:\money\screenshots\06_arena.png" --window-size=1440,900 --virtual-time-budget=4000 http://localhost:5173/#/arena

echo Done!
