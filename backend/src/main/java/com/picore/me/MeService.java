package com.picore.me;

import com.picore.booking.Booking;
import com.picore.booking.BookingRepository;
import com.picore.clazz.ClassSession;
import com.picore.clazz.ClassSessionRepository;
import com.picore.clazz.GymClass;
import com.picore.clazz.GymClassRepository;
import com.picore.common.exception.ApiException;
import com.picore.member.Member;
import com.picore.member.MemberRepository;
import com.picore.memberpackage.MemberPackage;
import com.picore.memberpackage.MemberPackageRepository;
import com.picore.me.dto.MyHistoryItem;
import com.picore.me.dto.MyPackageResponse;
import com.picore.packageplan.PackageType;
import com.picore.trainer.TrainerProfile;
import com.picore.trainer.TrainerRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Service cho khu vực "của tôi" của hội viên (UC2.2).
 * Luôn xác định hội viên từ userId trong SecurityContext — không nhận memberId từ client.
 */
@Service
public class MeService {

    // Cảnh báo khi số buổi còn lại ≤ ngưỡng này
    private static final int NEAR_EXPIRY_SESSIONS = 2;
    // Cảnh báo khi còn ≤ số ngày này là hết hạn
    private static final int NEAR_EXPIRY_DAYS = 7;

    public enum HistoryFilter {
        WEEK, MONTH, CUSTOM
    }

    private final MemberRepository memberRepository;
    private final MemberPackageRepository memberPackageRepository;
    private final BookingRepository bookingRepository;
    private final ClassSessionRepository classSessionRepository;
    private final GymClassRepository gymClassRepository;
    private final TrainerRepository trainerRepository;

    public MeService(MemberRepository memberRepository,
                     MemberPackageRepository memberPackageRepository,
                     BookingRepository bookingRepository,
                     ClassSessionRepository classSessionRepository,
                     GymClassRepository gymClassRepository,
                     TrainerRepository trainerRepository) {
        this.memberRepository = memberRepository;
        this.memberPackageRepository = memberPackageRepository;
        this.bookingRepository = bookingRepository;
        this.classSessionRepository = classSessionRepository;
        this.gymClassRepository = gymClassRepository;
        this.trainerRepository = trainerRepository;
    }

    @Transactional(readOnly = true)
    public List<MyPackageResponse> getMyPackages(Long userId) {
        Member member = requireMember(userId);
        LocalDate today = LocalDate.now();

        // Repo trả về startDate DESC; sort ổn định để ACTIVE lên trước (giữ nguyên startDate DESC trong nhóm).
        return memberPackageRepository.findByMemberIdOrderByStartDateDescIdDesc(member.getId()).stream()
                .sorted(Comparator.comparing(
                        (MemberPackage mp) -> mp.getStatus() == MemberPackage.MemberPackageStatus.ACTIVE ? 0 : 1))
                .map(mp -> toPackageResponse(mp, today))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<MyHistoryItem> getMyHistory(Long userId, HistoryFilter filter, LocalDate from, LocalDate to) {
        Member member = requireMember(userId);
        LocalDate today = LocalDate.now();

        LocalDate[] range = resolveRange(filter, from, to, today);
        LocalDate rangeFrom = range[0];
        LocalDate rangeTo = range[1];

        List<Booking> bookings = bookingRepository.findHistory(member.getId(), rangeFrom, rangeTo);
        if (bookings.isEmpty()) {
            return List.of();
        }

        // Batch-load ClassSession theo id (giữ thứ tự từ query booking).
        Map<Long, ClassSession> sessions = classSessionRepository
                .findAllById(bookings.stream().map(Booking::getClassSessionId).distinct().toList())
                .stream()
                .collect(Collectors.toMap(ClassSession::getId, Function.identity()));

        // Batch-load tên lớp nhóm.
        List<Long> gymClassIds = sessions.values().stream()
                .map(ClassSession::getGymClassId)
                .filter(id -> id != null)
                .distinct()
                .toList();
        Map<Long, String> gymClassNames = gymClassRepository.findAllById(gymClassIds).stream()
                .collect(Collectors.toMap(GymClass::getId, GymClass::getName));

        // Batch-load tên HLV (trainer_profile.id → user_account.full_name).
        List<Long> trainerIds = sessions.values().stream()
                .map(ClassSession::getTrainerId)
                .filter(id -> id != null)
                .distinct()
                .toList();
        Map<Long, String> trainerNames = trainerRepository.findAllById(trainerIds).stream()
                .filter(tp -> tp.getUserAccount() != null)
                .collect(Collectors.toMap(TrainerProfile::getId,
                        tp -> tp.getUserAccount().getFullName()));

        return bookings.stream()
                .map(b -> toHistoryItem(b, sessions.get(b.getClassSessionId()), gymClassNames, trainerNames))
                .filter(item -> item != null)
                .toList();
    }

    private MyPackageResponse toPackageResponse(MemberPackage mp, LocalDate today) {
        PackageType pt = mp.getPackageType();
        // Chỉ cảnh báo gói đang ACTIVE — gói đã hết hạn/hết buổi không cần badge
        boolean nearExpiry = mp.getStatus() == MemberPackage.MemberPackageStatus.ACTIVE && (
                (mp.getSessionsRemaining() != null && mp.getSessionsRemaining() <= NEAR_EXPIRY_SESSIONS)
                || ChronoUnit.DAYS.between(today, mp.getEndDate()) <= NEAR_EXPIRY_DAYS
        );

        return new MyPackageResponse(
                mp.getId(),
                pt.getName(),
                pt.getCategory() != null ? pt.getCategory().name() : null,
                mp.getSessionsRemaining(),
                mp.getStartDate().toString(),
                mp.getEndDate().toString(),
                mp.getStatus().name(),
                nearExpiry
        );
    }

    private MyHistoryItem toHistoryItem(Booking b, ClassSession cs,
                                        Map<Long, String> gymClassNames,
                                        Map<Long, String> trainerNames) {
        if (cs == null) {
            return null;
        }
        String className = resolveClassName(cs, gymClassNames);
        String trainerName = cs.getTrainerId() != null ? trainerNames.get(cs.getTrainerId()) : null;

        return new MyHistoryItem(
                cs.getSessionDate().toString(),
                className,
                trainerName,
                cs.getStartTime().toString(),
                cs.getEndTime().toString(),
                b.getStatus().name()
        );
    }

    private String resolveClassName(ClassSession cs, Map<Long, String> gymClassNames) {
        if (cs.getGymClassId() != null) {
            return gymClassNames.getOrDefault(cs.getGymClassId(), "Lớp tập");
        }
        // Buổi riêng (không thuộc lớp nhóm)
        return switch (cs.getType()) {
            case PRIVATE_1_1 -> "Buổi 1-1";
            case PRIVATE_1_2 -> "Buổi 1-2";
            default -> "Buổi tập";
        };
    }

    private LocalDate[] resolveRange(HistoryFilter filter, LocalDate from, LocalDate to, LocalDate today) {
        HistoryFilter f = filter != null ? filter : HistoryFilter.MONTH;
        return switch (f) {
            case WEEK -> new LocalDate[]{today.with(DayOfWeek.MONDAY), today};
            case MONTH -> new LocalDate[]{today.withDayOfMonth(1), today};
            case CUSTOM -> {
                if (from == null || to == null) {
                    throw new ApiException(HttpStatus.BAD_REQUEST, "from",
                            "Bộ lọc CUSTOM cần cả 'from' và 'to'");
                }
                if (from.isAfter(to)) {
                    throw new ApiException(HttpStatus.BAD_REQUEST, "from",
                            "'from' không được sau 'to'");
                }
                yield new LocalDate[]{from, to};
            }
        };
    }

    private Member requireMember(Long userId) {
        return memberRepository.findByUserAccountId(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                        "Không tìm thấy hồ sơ hội viên cho tài khoản này"));
    }
}
