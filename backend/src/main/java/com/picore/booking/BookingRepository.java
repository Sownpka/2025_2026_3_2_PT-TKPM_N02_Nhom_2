package com.picore.booking;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * Repository cho Booking. UC5.1/UC5.3 mở rộng thêm CRUD + điểm danh.
 * UC2.2 dùng findHistory để liệt kê lịch sử buổi tập (chỉ ATTENDED / NO_SHOW) của hội viên.
 */
public interface BookingRepository extends JpaRepository<Booking, Long> {

    // Lịch sử buổi tập: join booking → class_session (ad-hoc join theo id),
    // chỉ lấy các buổi đã ATTENDED / NO_SHOW trong khoảng ngày, sắp xếp mới nhất trước.
    @Query("""
            SELECT b FROM Booking b
            JOIN ClassSession cs ON cs.id = b.classSessionId
            WHERE b.memberId = :memberId
              AND b.status IN (com.picore.booking.Booking.BookingStatus.ATTENDED,
                               com.picore.booking.Booking.BookingStatus.NO_SHOW)
              AND cs.sessionDate BETWEEN :from AND :to
            ORDER BY cs.sessionDate DESC, cs.startTime DESC
            """)
    List<Booking> findHistory(@Param("memberId") Long memberId,
                              @Param("from") LocalDate from,
                              @Param("to") LocalDate to);

    // UC5.1 — đếm số chỗ đã đặt (BOOKED + ATTENDED) để kiểm tra sức chứa.
    int countByClassSessionIdAndStatusIn(Long classSessionId, List<Booking.BookingStatus> statuses);

    // UC5.1 — chống đặt trùng cùng buổi học.
    boolean existsByClassSessionIdAndMemberIdAndStatusIn(
            Long classSessionId, Long memberId, List<Booking.BookingStatus> statuses);

    // UC5.1 — danh sách lịch tập của hội viên theo trạng thái (GET /me/bookings).
    List<Booking> findByMemberIdAndStatusInOrderByBookedAtDesc(
            Long memberId, List<Booking.BookingStatus> statuses);

    // UC5.1 — nạp booking của hội viên cho các buổi trong timetable (myBookingStatus).
    List<Booking> findByMemberIdAndClassSessionIdIn(Long memberId, List<Long> sessionIds);

    // UC5.1 — nạp booking (đang chiếm chỗ) của nhiều buổi để đếm bookedCount cho timetable.
    List<Booking> findByClassSessionIdInAndStatusIn(
            List<Long> sessionIds, List<Booking.BookingStatus> statuses);

    // UC5.3 — điểm danh: danh sách booking của 1 buổi theo trạng thái (bỏ CANCELLED).
    List<Booking> findByClassSessionIdAndStatusIn(
            Long classSessionId, List<Booking.BookingStatus> statuses);

    // UC4.4 — batch đếm booking đang chiếm chỗ cho nhiều buổi (tránh N+1).
    // Trả về [classSessionId, count] cho mỗi buổi có ít nhất 1 booking khớp.
    @Query("SELECT b.classSessionId, COUNT(b) FROM Booking b "
            + "WHERE b.classSessionId IN :sessionIds AND b.status IN :statuses "
            + "GROUP BY b.classSessionId")
    List<Object[]> countByClassSessionIdInAndStatusIn(
            @Param("sessionIds") List<Long> sessionIds,
            @Param("statuses") List<Booking.BookingStatus> statuses);

    // UC4.4 — lấy 1 booking đầu (còn chiếm chỗ) của 1 buổi PRIVATE_1_1 để hiện tên hội viên.
    Optional<Booking> findFirstByClassSessionIdAndStatusIn(
            Long classSessionId, List<Booking.BookingStatus> statuses);

    // UC5.5 — toàn bộ booking của 1 buổi (mọi trạng thái, kể cả CANCELLED) để HLV xem danh sách học viên.
    List<Booking> findByClassSessionIdOrderByBookedAtAsc(Long classSessionId);
}
