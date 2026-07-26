-- UC4.3 — Quản lý huấn luyện viên
-- Tạo 3 bảng: trainer_profile (đầy đủ) + gym_class, class_session (stub cho UC4.1/UC5.2 populate).
-- Ca làm việc là DỮ LIỆU DẪN XUẤT (derived) từ class_session — KHÔNG có bảng work_shift.
-- Lưu ý: dự án hiện quản lý schema bằng Hibernate ddl-auto (dev: create-drop, prod: validate)
--   và CHƯA cấu hình Flyway. File migration này bám đúng data model spec UC4.3,
--   tên/cột phải khớp JPA entity để `ddl-auto: validate` pass khi bật Flyway.

-- ---------------------------------------------------------------------------
-- 1) trainer_profile — hồ sơ HLV gắn với 1 tài khoản role = TRAINER (1-1)
-- ---------------------------------------------------------------------------
CREATE TABLE trainer_profile (
    id              BIGINT       NOT NULL AUTO_INCREMENT,
    user_account_id BIGINT       NOT NULL,                     -- FK → user_account(id), UNIQUE (1 tài khoản 1 hồ sơ)
    specialty       VARCHAR(200) NULL,                          -- Chuyên môn
    contact_phone   VARCHAR(20)  NULL,                          -- SĐT liên hệ
    status          VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',     -- ACTIVE / INACTIVE (soft delete)
    created_at      DATETIME     NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_trainer_profile_user_account UNIQUE (user_account_id),
    CONSTRAINT fk_trainer_profile_user_account
        FOREIGN KEY (user_account_id) REFERENCES user_account (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 2) gym_class — lớp học cố định (STUB; UC4.1 sẽ populate/mở rộng)
-- ---------------------------------------------------------------------------
CREATE TABLE gym_class (
    id             BIGINT       NOT NULL AUTO_INCREMENT,
    name           VARCHAR(100) NOT NULL,                       -- Tên lớp (UNIQUE)
    equipment_type VARCHAR(100) NULL,                           -- Loại thiết bị (UC4.2)
    trainer_id     BIGINT       NULL,                           -- FK → trainer_profile(id)
    days_of_week   VARCHAR(50)  NOT NULL DEFAULT '',            -- CSV thứ trong tuần (MON,TUE,...)
    start_time     TIME         NOT NULL DEFAULT '00:00:00',
    end_time       TIME         NOT NULL DEFAULT '00:00:00',
    capacity       INT          NOT NULL DEFAULT 0,
    description    TEXT         NULL,
    status         VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',      -- ACTIVE / INACTIVE
    created_at     DATETIME     NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_gym_class_name UNIQUE (name),
    CONSTRAINT fk_gym_class_trainer
        FOREIGN KEY (trainer_id) REFERENCES trainer_profile (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 3) class_session — buổi tập cụ thể (lớp nhóm / buổi 1-1 / 1-2) (STUB)
--    Nguồn dữ liệu tổng hợp ca làm việc & tổng giờ dạy của HLV theo tuần.
-- ---------------------------------------------------------------------------
CREATE TABLE class_session (
    id           BIGINT      NOT NULL AUTO_INCREMENT,
    gym_class_id BIGINT      NULL,                              -- FK → gym_class(id); NULL cho buổi 1-1/1-2
    trainer_id   BIGINT      NOT NULL,                          -- FK → trainer_profile(id)
    session_date DATE        NOT NULL,
    start_time   TIME        NOT NULL,
    end_time     TIME        NOT NULL,
    type         VARCHAR(20) NOT NULL DEFAULT 'GROUP',          -- GROUP / PRIVATE_1_1 / PRIVATE_1_2
    capacity     INT         NOT NULL DEFAULT 1,
    created_at   DATETIME    NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_class_session_gym_class
        FOREIGN KEY (gym_class_id) REFERENCES gym_class (id),
    CONSTRAINT fk_class_session_trainer
        FOREIGN KEY (trainer_id) REFERENCES trainer_profile (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Chỉ mục hỗ trợ tổng hợp ca làm việc theo HLV + tuần (derived data)
CREATE INDEX idx_class_session_trainer_date
    ON class_session (trainer_id, session_date);

-- ---------------------------------------------------------------------------
-- Seed 3 HLV (CLAUDE.md mục 9): gắn hồ sơ vào các tài khoản role = TRAINER sẵn có.
-- Dùng INSERT ... SELECT để an toàn FK: chỉ tạo hồ sơ cho tài khoản TRAINER
-- thực sự tồn tại và chưa có hồ sơ. Không hardcode id → không vỡ khi thứ tự seed khác.
-- ---------------------------------------------------------------------------
INSERT INTO trainer_profile (user_account_id, specialty, contact_phone, status, created_at)
SELECT ua.id,
       'Pilates cơ bản, Reformer',
       COALESCE(ua.phone, ''),
       'ACTIVE',
       NOW()
FROM user_account ua
WHERE ua.role = 'TRAINER'
  AND NOT EXISTS (
      SELECT 1 FROM trainer_profile tp WHERE tp.user_account_id = ua.id
  );
