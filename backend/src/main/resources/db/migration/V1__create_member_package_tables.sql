-- UC3.2 — Đăng ký & gia hạn gói tập
-- Tạo 2 bảng: member_package và package_transaction (nguồn doanh thu UC6.1).
-- Lưu ý: dự án hiện quản lý schema bằng Hibernate ddl-auto (dev: create-drop, prod: validate)
--   và CHƯA cấu hình Flyway. File migration này bám đúng data model mục 7 CLAUDE.md,
--   sẵn sàng dùng khi bật Flyway. Tên/cột phải khớp với JPA entity để `ddl-auto: validate` pass.

CREATE TABLE member_package (
    id                 BIGINT       NOT NULL AUTO_INCREMENT,
    member_id          BIGINT       NOT NULL,
    package_type_id    BIGINT       NOT NULL,
    start_date         DATE         NOT NULL,
    end_date           DATE         NOT NULL,
    sessions_remaining INT          NULL,               -- NULL = không giới hạn
    status             VARCHAR(20)  NOT NULL,           -- ACTIVE / EXPIRED / USED_UP
    created_at         DATETIME     NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_member_package_member
        FOREIGN KEY (member_id) REFERENCES member (id),
    CONSTRAINT fk_member_package_package_type
        FOREIGN KEY (package_type_id) REFERENCES package_type (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE INDEX idx_member_package_member_status
    ON member_package (member_id, status);

CREATE TABLE package_transaction (
    id                 BIGINT         NOT NULL AUTO_INCREMENT,
    member_package_id  BIGINT         NOT NULL,
    member_id          BIGINT         NOT NULL,
    amount             DECIMAL(12, 0) NOT NULL,          -- snapshot giá gói tại thời điểm mua
    type               VARCHAR(20)    NOT NULL,          -- NEW / RENEWAL
    created_at         DATETIME       NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_package_transaction_member_package
        FOREIGN KEY (member_package_id) REFERENCES member_package (id),
    CONSTRAINT fk_package_transaction_member
        FOREIGN KEY (member_id) REFERENCES member (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Chỉ mục hỗ trợ báo cáo doanh thu theo tháng (UC6.1)
CREATE INDEX idx_package_transaction_created_at
    ON package_transaction (created_at);
