@echo off
title PiCore - Khoi dong du an
color 0A

echo ============================================
echo   PiCore - He thong quan ly phong tap
echo ============================================
echo.

:: Kiem tra MySQL (port 3306)
echo [1/3] Kiem tra MySQL...
netstat -ano | findstr :3306 | findstr LISTENING >nul 2>&1
if %errorlevel% neq 0 (
    echo [LOI] MySQL chua chay! Hay bat XAMPP / MySQL truoc.
    echo.
    pause
    exit /b 1
)
echo      MySQL dang chay. OK

:: Mo Backend
echo [2/3] Khoi dong Backend (Spring Boot :8080)...
start "PiCore - Backend" powershell -NoExit -Command "cd D:\Pi-core\backend; Write-Host '=== BACKEND ===' -ForegroundColor Cyan; mvn spring-boot:run"

:: Cho backend khoi dong mot chut truoc
timeout /t 3 /nobreak >nul

:: Mo Frontend
echo [3/3] Khoi dong Frontend (Vite :5173)...
start "PiCore - Frontend" powershell -NoExit -Command "cd D:\Pi-core\frontend; Write-Host '=== FRONTEND ===' -ForegroundColor Green; npm run dev"

echo.
echo Dang khoi dong... cho khoang 30-60 giay de backend san sang.
echo Sau do truy cap: http://localhost:5173
echo.
timeout /t 5 /nobreak >nul

:: Mo browser
start "" "http://localhost:5173"

echo.
echo Nhan phim bat ky de dong cua so nay...
pause >nul
