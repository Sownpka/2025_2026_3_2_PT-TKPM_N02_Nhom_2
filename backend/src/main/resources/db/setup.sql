-- Chạy script này với quyền root MySQL một lần duy nhất
-- mysql -u root -p < setup.sql

CREATE DATABASE IF NOT EXISTS picore
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'picore'@'localhost' IDENTIFIED BY 'picore123';
GRANT ALL PRIVILEGES ON picore.* TO 'picore'@'localhost';
FLUSH PRIVILEGES;

SELECT 'Database picore và user picore đã sẵn sàng.' AS result;
