#!/bin/bash
BACKUP_DIR="/backups"
FILENAME="picore_$(date +%Y-%m-%d).sql"
mkdir -p "$BACKUP_DIR"
mysqldump -upicore -ppicore123 picore > "$BACKUP_DIR/$FILENAME"
echo "Backup: $BACKUP_DIR/$FILENAME"
# Xóa backup cũ hơn 30 ngày
find "$BACKUP_DIR" -name "*.sql" -mtime +30 -delete
