package com.picore.booking;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

/**
 * Entity stub cho lượt đặt buổi tập của hội viên. UC5.1 (đặt lịch) và UC5.3 (điểm danh)
 * sẽ implement đầy đủ Controller/Service và populate dữ liệu.
 * Ở UC2.2 chỉ cần đủ để join lấy lịch sử buổi tập (ATTENDED / NO_SHOW) của hội viên.
 * Đến khi UC5.1 tạo dữ liệu, /me/history sẽ trả về danh sách rỗng.
 */
@Entity
@Table(name = "booking")
public class Booking {

    public enum BookingStatus {
        BOOKED, CANCELLED, ATTENDED, NO_SHOW
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Nullable: buổi tập thường gắn class_session_id, nhưng điểm danh nhanh (walk-in, UC5.3)
    // tạo booking không gắn buổi cụ thể (classSessionId = null). Không có FK constraint ở entity.
    @Column(name = "class_session_id")
    private Long classSessionId;

    @Column(name = "member_id", nullable = false)
    private Long memberId;

    @Column(name = "member_package_id")
    private Long memberPackageId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private BookingStatus status = BookingStatus.BOOKED;

    @Column(name = "booked_at", nullable = false, updatable = false)
    private LocalDateTime bookedAt;

    @Column(name = "cancelled_at")
    private LocalDateTime cancelledAt;

    @Column(name = "checked_in_at")
    private LocalDateTime checkedInAt;

    public Booking() {
    }

    @PrePersist
    protected void onCreate() {
        if (bookedAt == null) {
            bookedAt = LocalDateTime.now();
        }
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getClassSessionId() {
        return classSessionId;
    }

    public void setClassSessionId(Long classSessionId) {
        this.classSessionId = classSessionId;
    }

    public Long getMemberId() {
        return memberId;
    }

    public void setMemberId(Long memberId) {
        this.memberId = memberId;
    }

    public Long getMemberPackageId() {
        return memberPackageId;
    }

    public void setMemberPackageId(Long memberPackageId) {
        this.memberPackageId = memberPackageId;
    }

    public BookingStatus getStatus() {
        return status;
    }

    public void setStatus(BookingStatus status) {
        this.status = status;
    }

    public LocalDateTime getBookedAt() {
        return bookedAt;
    }

    public void setBookedAt(LocalDateTime bookedAt) {
        this.bookedAt = bookedAt;
    }

    public LocalDateTime getCancelledAt() {
        return cancelledAt;
    }

    public void setCancelledAt(LocalDateTime cancelledAt) {
        this.cancelledAt = cancelledAt;
    }

    public LocalDateTime getCheckedInAt() {
        return checkedInAt;
    }

    public void setCheckedInAt(LocalDateTime checkedInAt) {
        this.checkedInAt = checkedInAt;
    }
}
