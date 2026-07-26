@echo off
REM Daily backup script — chạy qua Task Scheduler mỗi ngày lúc 2:00
set BACKUP_DIR=D:\Pi-core\backups
set DATE_STR=%date:~10,4%-%date:~4,2%-%date:~7,2%
set FILENAME=picore_%DATE_STR%.sql
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"
"d:\xampp\mysql\bin\mysqldump.exe" -upicore -ppicore123 picore > "%BACKUP_DIR%\%FILENAME%"
echo Backup completed: %BACKUP_DIR%\%FILENAME%
REM Xóa backup cũ hơn 30 ngày
forfiles /p "%BACKUP_DIR%" /m "*.sql" /d -30 /c "cmd /c del @path" 2>nul
