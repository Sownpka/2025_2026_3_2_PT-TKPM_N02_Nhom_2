-- UC5.2 — Ngăn race condition khi hai request đặt cùng khung giờ / HLV:
-- Đảm bảo mỗi HLV chỉ có tối đa 1 ClassSession tại (trainer_id, session_date, start_time).
-- Áp dụng cho cả buổi nhóm (GROUP) lẫn buổi riêng (PRIVATE_1_1/1_2).
ALTER TABLE class_session
    ADD CONSTRAINT uq_class_session_trainer_slot
        UNIQUE (trainer_id, session_date, start_time);
