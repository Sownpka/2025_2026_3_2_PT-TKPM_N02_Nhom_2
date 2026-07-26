-- UC4.2 — Khai báo thiết bị
-- Tạo bảng equipment. Bám đúng data model mục 7 CLAUDE.md.
-- Lưu ý: dự án hiện quản lý schema bằng Hibernate ddl-auto (dev: create-drop, prod: validate)
--   và CHƯA cấu hình Flyway. File migration này sẵn sàng dùng khi bật Flyway;
--   tên/cột phải khớp với JPA entity để `ddl-auto: validate` pass.

CREATE TABLE equipment (
    id         BIGINT       NOT NULL AUTO_INCREMENT,
    code       VARCHAR(50)  NOT NULL,                     -- Mã thiết bị (UNIQUE toàn hệ thống)
    name       VARCHAR(100) NOT NULL,                     -- Tên
    type       VARCHAR(100) NOT NULL,                     -- Loại (text tự do: Reformer, Mat, Chair...)
    location   VARCHAR(100) NULL,                         -- Vị trí/Phòng
    note       TEXT         NULL,                          -- Ghi chú
    status     VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',    -- ACTIVE / INACTIVE (soft delete)
    created_at DATETIME     NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_equipment_code UNIQUE (code)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Chỉ mục hỗ trợ đếm số thiết bị theo loại (UC4.2 count-by-type → tham chiếu sức chứa UC4.1)
CREATE INDEX idx_equipment_type_status
    ON equipment (type, status);

-- Seed data tham chiếu (CLAUDE.md mục 9): 8 máy Reformer + 1 thảm Mat
INSERT INTO equipment (code, name, type, location, note, status, created_at) VALUES
    ('REF-01', 'Máy Reformer 01', 'Reformer', 'Phòng A', '', 'ACTIVE', NOW()),
    ('REF-02', 'Máy Reformer 02', 'Reformer', 'Phòng A', '', 'ACTIVE', NOW()),
    ('REF-03', 'Máy Reformer 03', 'Reformer', 'Phòng A', '', 'ACTIVE', NOW()),
    ('REF-04', 'Máy Reformer 04', 'Reformer', 'Phòng A', '', 'ACTIVE', NOW()),
    ('REF-05', 'Máy Reformer 05', 'Reformer', 'Phòng B', '', 'ACTIVE', NOW()),
    ('REF-06', 'Máy Reformer 06', 'Reformer', 'Phòng B', '', 'ACTIVE', NOW()),
    ('REF-07', 'Máy Reformer 07', 'Reformer', 'Phòng B', '', 'ACTIVE', NOW()),
    ('REF-08', 'Máy Reformer 08', 'Reformer', 'Phòng B', '', 'ACTIVE', NOW()),
    ('MAT-01', 'Thảm Mat 01', 'Mat', 'Phòng B', '', 'ACTIVE', NOW());
