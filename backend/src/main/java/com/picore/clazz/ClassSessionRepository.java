package com.picore.clazz;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

/**
 * Repository stub cho ClassSession. UC4.3 dùng để tổng hợp ca làm việc (derived data)
 * và tổng giờ dạy trong tuần của HLV. UC4.1/UC5.2 sẽ populate dữ liệu.
 */
public interface ClassSessionRepository extends JpaRepository<ClassSession, Long> {

    // Lưới ca làm việc: các buổi của HLV trong khoảng [start, end] (T2 → CN của tuần chọn).
    List<ClassSession> findByTrainerIdAndSessionDateBetweenOrderBySessionDateAscStartTimeAsc(
            Long trainerId, LocalDate start, LocalDate end);

    // Tổng số phút dạy trong tuần hiện tại = SUM(end_time - start_time). Trả 0 nếu chưa có buổi nào.
    @Query(value = """
            SELECT COALESCE(SUM(TIMESTAMPDIFF(MINUTE, cs.start_time, cs.end_time)), 0)
            FROM class_session cs
            WHERE cs.trainer_id = :trainerId
              AND cs.session_date BETWEEN :start AND :end
            """, nativeQuery = true)
    long sumMinutesInRange(@Param("trainerId") Long trainerId,
                           @Param("start") LocalDate start,
                           @Param("end") LocalDate end);

    // Timetable: các buổi thuộc lớp nhóm (gym_class_id != NULL) trong khoảng tuần.
    List<ClassSession> findByGymClassIdIsNotNullAndSessionDateBetweenOrderBySessionDateAscStartTimeAsc(
            LocalDate start, LocalDate end);

    // E-3 check: các buổi PRIVATE 1-1/1-2 của HLV trong range ngày + overlap giờ.
    @Query("""
            SELECT cs FROM ClassSession cs
            WHERE cs.trainerId = :trainerId
              AND cs.type IN (com.picore.clazz.ClassSession.SessionType.PRIVATE_1_1,
                              com.picore.clazz.ClassSession.SessionType.PRIVATE_1_2)
              AND cs.sessionDate BETWEEN :start AND :end
              AND NOT (cs.endTime <= :startTime OR cs.startTime >= :endTime)
            """)
    List<ClassSession> findConflictingPrivateSessions(
            @Param("trainerId") Long trainerId,
            @Param("start") LocalDate start,
            @Param("end") LocalDate end,
            @Param("startTime") LocalTime startTime,
            @Param("endTime") LocalTime endTime);

    // Bất kỳ buổi nào (GROUP hoặc PRIVATE) của HLV trong range + overlap giờ — dùng cho available-for-class.
    @Query("""
            SELECT cs FROM ClassSession cs
            WHERE cs.trainerId = :trainerId
              AND cs.sessionDate BETWEEN :start AND :end
              AND NOT (cs.endTime <= :startTime OR cs.startTime >= :endTime)
            """)
    List<ClassSession> findConflictingSessions(
            @Param("trainerId") Long trainerId,
            @Param("start") LocalDate start,
            @Param("end") LocalDate end,
            @Param("startTime") LocalTime startTime,
            @Param("endTime") LocalTime endTime);

    // UC5.2 — các buổi PRIVATE_1_2 của HLV tại đúng khung giờ (để ghép người). Trả list
    // (có thể >1 nếu đã có buổi full + buổi mới), service tự đếm booking để chọn buổi còn chỗ.
    @Query("""
            SELECT cs FROM ClassSession cs
            WHERE cs.trainerId = :trainerId
              AND cs.sessionDate = :date
              AND cs.startTime = :startTime
              AND cs.type = com.picore.clazz.ClassSession.SessionType.PRIVATE_1_2
            ORDER BY cs.id ASC
            """)
    List<ClassSession> findPrivate12Sessions(@Param("trainerId") Long trainerId,
                                             @Param("date") LocalDate date,
                                             @Param("startTime") LocalTime startTime);

    // Xóa future sessions của 1 gym_class (khi update/deactivate).
    @Modifying
    @Query("DELETE FROM ClassSession cs WHERE cs.gymClassId = :gymClassId AND cs.sessionDate > :today")
    void deleteFutureSessionsByGymClassId(@Param("gymClassId") Long gymClassId, @Param("today") LocalDate today);

    // UC5.3 — điểm danh: các buổi trong 1 ngày (hôm nay), sắp xếp theo giờ bắt đầu.
    List<ClassSession> findBySessionDateOrderByStartTimeAsc(LocalDate sessionDate);

    // UC5.1 — khóa bi quan (PESSIMISTIC_WRITE) khi đặt lịch để tránh race condition vượt sức chứa.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT cs FROM ClassSession cs WHERE cs.id = :id")
    Optional<ClassSession> findByIdForUpdate(@Param("id") Long id);
}
