package com.picore.common;

import com.picore.auth.UserAccount;
import com.picore.auth.UserAccountRepository;
import com.picore.booking.Booking;
import com.picore.booking.BookingRepository;
import com.picore.clazz.ClassSession;
import com.picore.clazz.ClassSessionRepository;
import com.picore.clazz.GymClass;
import com.picore.clazz.GymClassRepository;
import com.picore.equipment.Equipment;
import com.picore.equipment.EquipmentRepository;
import com.picore.finance.Expense;
import com.picore.finance.ExpenseRepository;
import com.picore.member.Member;
import com.picore.member.MemberRepository;
import com.picore.memberpackage.MemberPackage;
import com.picore.memberpackage.MemberPackageRepository;
import com.picore.memberpackage.PackageTransaction;
import com.picore.memberpackage.PackageTransactionRepository;
import com.picore.packageplan.PackageType;
import com.picore.packageplan.PackageTypeRepository;
import com.picore.trainer.TrainerProfile;
import com.picore.trainer.TrainerRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.temporal.TemporalAdjusters;
import java.util.List;

@Component
public class DataSeeder implements CommandLineRunner {

    private final UserAccountRepository userRepo;
    private final MemberRepository memberRepo;
    private final PackageTypeRepository pkgTypeRepo;
    private final MemberPackageRepository memberPkgRepo;
    private final PackageTransactionRepository txRepo;
    private final EquipmentRepository equipRepo;
    private final TrainerRepository trainerRepo;
    private final GymClassRepository gymClassRepo;
    private final ClassSessionRepository sessionRepo;
    private final BookingRepository bookingRepo;
    private final ExpenseRepository expenseRepo;
    private final BCryptPasswordEncoder bcrypt = new BCryptPasswordEncoder();

    public DataSeeder(UserAccountRepository userRepo, MemberRepository memberRepo,
                      PackageTypeRepository pkgTypeRepo, MemberPackageRepository memberPkgRepo,
                      PackageTransactionRepository txRepo, EquipmentRepository equipRepo,
                      TrainerRepository trainerRepo, GymClassRepository gymClassRepo,
                      ClassSessionRepository sessionRepo, BookingRepository bookingRepo,
                      ExpenseRepository expenseRepo) {
        this.userRepo = userRepo;
        this.memberRepo = memberRepo;
        this.pkgTypeRepo = pkgTypeRepo;
        this.memberPkgRepo = memberPkgRepo;
        this.txRepo = txRepo;
        this.equipRepo = equipRepo;
        this.trainerRepo = trainerRepo;
        this.gymClassRepo = gymClassRepo;
        this.sessionRepo = sessionRepo;
        this.bookingRepo = bookingRepo;
        this.expenseRepo = expenseRepo;
    }

    @Override
    @Transactional
    public void run(String... args) {
        if (userRepo.count() > 0) return;

        String adminPw = bcrypt.encode("Admin123!");
        String staffPw = bcrypt.encode("Staff123!");
        String memberPw = bcrypt.encode("Member123!");

        UserAccount admin = saveUser("Nguyễn Quản Trị", "admin@picore.vn", "0900000001", adminPw, UserAccount.Role.ADMIN);
        saveUser("Trần Lễ Tân", "le.tan1@picore.vn", "0900000002", staffPw, UserAccount.Role.RECEPTIONIST);
        saveUser("Phạm Thị Lan", "le.tan2@picore.vn", "0900000003", staffPw, UserAccount.Role.RECEPTIONIST);

        UserAccount hlv1User = saveUser("Nguyễn Văn Minh", "hlv1@picore.vn", "0900000004", staffPw, UserAccount.Role.TRAINER);
        UserAccount hlv2User = saveUser("Lê Thị Hoa", "hlv2@picore.vn", "0900000005", staffPw, UserAccount.Role.TRAINER);
        UserAccount hlv3User = saveUser("Phạm Văn Đức", "hlv3@picore.vn", "0900000006", staffPw, UserAccount.Role.TRAINER);

        TrainerProfile hlv1 = saveTrainer(hlv1User, "Pilates cơ bản, Reformer", "0900000004");
        TrainerProfile hlv2 = saveTrainer(hlv2User, "Pilates nâng cao, Mat", "0900000005");
        TrainerProfile hlv3 = saveTrainer(hlv3User, "Reformer, Barre", "0900000006");

        PackageType goi12Buoi = savePkgType("Gói 12 buổi", PackageType.PackageCategory.THEO_BUOI, 12, 60, 2_400_000L);
        PackageType goiThang = savePkgType("Gói tháng", PackageType.PackageCategory.THEO_THANG, null, 30, 1_500_000L);
        PackageType goi3Thang = savePkgType("Gói không giới hạn 3 tháng", PackageType.PackageCategory.KHONG_GIOI_HAN, null, 90, 3_500_000L);
        PackageType goi11 = savePkgType("Gói 1-1 (10 buổi)", PackageType.PackageCategory.GOI_1_1, 10, 60, 5_000_000L);
        PackageType goi12Pkg = savePkgType("Gói 1-2 (10 buổi)", PackageType.PackageCategory.GOI_1_2, 10, 60, 3_000_000L);

        seedEquipment();

        String[] names = {
            "Nguyễn Thị Ánh", "Trần Minh Tuấn", "Lê Thị Thu", "Phạm Văn Hùng",
            "Hoàng Thị Mai", "Vũ Đức Thịnh", "Bùi Thị Lan", "Đỗ Minh Khoa",
            "Ngô Thị Hà", "Dương Văn Long"
        };
        Member.Gender[] genders = {
            Member.Gender.FEMALE, Member.Gender.MALE, Member.Gender.FEMALE, Member.Gender.MALE,
            Member.Gender.FEMALE, Member.Gender.MALE, Member.Gender.FEMALE, Member.Gender.MALE,
            Member.Gender.FEMALE, Member.Gender.MALE
        };
        PackageType[] pkgTypes = {goi12Buoi, goiThang, goi3Thang, goi12Buoi, goiThang,
                                   goi3Thang, goi12Buoi, goiThang, goi11, goi12Pkg};
        // Sessions remaining: -1 = no limit (THEO_THANG/KHONG_GIOI_HAN)
        Integer[] sessions = {8, null, null, 10, null, null, 2, null, 7, 5};

        LocalDate today = LocalDate.now();

        for (int i = 0; i < 10; i++) {
            String email = "member" + (i + 1) + "@example.com";
            String phone = "091" + String.format("%07d", i + 1);
            UserAccount ua = saveUser(names[i], email, phone, memberPw, UserAccount.Role.MEMBER);

            Member m = new Member();
            m.setFullName(names[i]);
            m.setPhone(phone);
            m.setEmail(email);
            m.setGender(genders[i]);
            m.setUserAccount(ua);
            m = memberRepo.save(m);

            PackageType pt = pkgTypes[i];
            MemberPackage mp = new MemberPackage();
            mp.setMember(m);
            mp.setPackageType(pt);
            mp.setStartDate(today.minusDays(30));
            mp.setEndDate(today.minusDays(30).plusDays(pt.getDurationDays()));
            mp.setSessionsRemaining(sessions[i]);
            mp.setStatus(MemberPackage.MemberPackageStatus.ACTIVE);
            mp = memberPkgRepo.save(mp);

            // Record the transaction (set historical created_at for finance demo)
            PackageTransaction tx = new PackageTransaction();
            tx.setMemberPackage(mp);
            tx.setMember(m);
            tx.setAmount(pt.getPrice());
            tx.setType(PackageTransaction.TransactionType.NEW);
            // Spread over 6 months
            LocalDateTime txDate = LocalDateTime.now().minusMonths(5 - (i / 2)).withDayOfMonth(5 + i);
            tx.setCreatedAt(txDate);
            txRepo.save(tx);
        }

        // Extra transactions to fill 6 months of finance data
        seedExtraTransactions(admin, goi12Buoi, goiThang, goi3Thang, goi11);

        // Gym classes + sessions for this week and next
        LocalDate monday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));

        GymClass ref1 = saveGymClass("Reformer Cơ bản", "Reformer", hlv1.getId(), "MONDAY,WEDNESDAY,FRIDAY", LocalTime.of(7, 0), LocalTime.of(8, 0), 8);
        GymClass ref2 = saveGymClass("Reformer Nâng cao", "Reformer", hlv2.getId(), "TUESDAY,THURSDAY", LocalTime.of(9, 0), LocalTime.of(10, 0), 6);
        GymClass mat1 = saveGymClass("Mat Pilates", "Mat", hlv3.getId(), "MONDAY,WEDNESDAY", LocalTime.of(10, 0), LocalTime.of(11, 0), 10);
        GymClass ref3 = saveGymClass("Reformer Buổi chiều", "Reformer", hlv1.getId(), "TUESDAY,THURSDAY,SATURDAY", LocalTime.of(15, 0), LocalTime.of(16, 0), 8);
        GymClass mat2 = saveGymClass("Mat Nâng cao", "Mat", hlv2.getId(), "MONDAY,FRIDAY", LocalTime.of(17, 0), LocalTime.of(18, 0), 10);
        GymClass barre = saveGymClass("Barre", "Mat", hlv3.getId(), "WEDNESDAY,FRIDAY", LocalTime.of(8, 0), LocalTime.of(9, 0), 8);

        List<GymClass> classes = List.of(ref1, ref2, mat1, ref3, mat2, barre);
        List<TrainerProfile> trainers = List.of(hlv1, hlv2, hlv3, hlv1, hlv2, hlv3);

        // Generate sessions for this week + next week
        for (int week = 0; week < 2; week++) {
            LocalDate weekStart = monday.plusWeeks(week);
            for (int ci = 0; ci < classes.size(); ci++) {
                GymClass gc = classes.get(ci);
                TrainerProfile trainer = trainers.get(ci);
                String[] days = gc.getDaysOfWeek().split(",");
                for (String day : days) {
                    LocalDate sessionDate = weekStart.plusDays(dayOffset(day));
                    if (!sessionDate.isBefore(monday)) { // don't seed past sessions
                        ClassSession cs = new ClassSession();
                        cs.setGymClassId(gc.getId());
                        cs.setTrainerId(trainer.getId());
                        cs.setSessionDate(sessionDate);
                        cs.setStartTime(gc.getStartTime());
                        cs.setEndTime(gc.getEndTime());
                        cs.setType(ClassSession.SessionType.GROUP);
                        cs.setCapacity(gc.getCapacity());
                        sessionRepo.save(cs);
                    }
                }
            }
        }

        // Add a few bookings for demo (use first 3 members on a session today or upcoming)
        List<ClassSession> upcomingSessions = sessionRepo.findAll().stream()
                .filter(s -> !s.getSessionDate().isBefore(today))
                .limit(3)
                .toList();
        List<Member> allMembers = memberRepo.findAll();
        List<MemberPackage> allPkgs = memberPkgRepo.findAll();

        for (int i = 0; i < Math.min(3, upcomingSessions.size()); i++) {
            ClassSession cs = upcomingSessions.get(i);
            for (int j = 0; j < 3 && j < allMembers.size(); j++) {
                Member member = allMembers.get(j);
                MemberPackage pkg = allPkgs.stream()
                        .filter(p -> p.getMember().getId().equals(member.getId()))
                        .findFirst().orElse(null);
                if (pkg == null) continue;
                Booking bk = new Booking();
                bk.setClassSessionId(cs.getId());
                bk.setMemberId(member.getId());
                bk.setMemberPackageId(pkg.getId());
                bk.setStatus(Booking.BookingStatus.BOOKED);
                bookingRepo.save(bk);
            }
        }

        seedExpenses(admin.getId(), today);
    }

    private void seedExtraTransactions(UserAccount admin, PackageType... pkgTypes) {
        List<Member> members = memberRepo.findAll();
        if (members.isEmpty()) return;

        int[][] monthDays = {{2, 8, 14}, {5, 12, 18, 22}, {3, 9, 15, 20, 25},
                             {4, 10, 16, 22, 27}, {2, 7, 13, 18, 23, 28}, {5, 11}};
        LocalDate today = LocalDate.now();

        for (int m = 0; m < 6; m++) {
            int monthsAgo = 5 - m;
            for (int day : monthDays[m]) {
                Member member = members.get((m * 3 + day) % members.size());
                PackageType pt = pkgTypes[(m + day) % pkgTypes.length];

                // Create a dummy MemberPackage for this historical transaction
                MemberPackage mp = new MemberPackage();
                mp.setMember(member);
                mp.setPackageType(pt);
                LocalDate startDate = today.minusMonths(monthsAgo).withDayOfMonth(Math.min(day, 28));
                mp.setStartDate(startDate);
                mp.setEndDate(startDate.plusDays(pt.getDurationDays()));
                mp.setSessionsRemaining(pt.getSessions());
                mp.setStatus(MemberPackage.MemberPackageStatus.EXPIRED);
                mp = memberPkgRepo.save(mp);

                PackageTransaction tx = new PackageTransaction();
                tx.setMemberPackage(mp);
                tx.setMember(member);
                tx.setAmount(pt.getPrice());
                tx.setType(PackageTransaction.TransactionType.RENEWAL);
                tx.setCreatedAt(LocalDateTime.of(startDate, LocalTime.of(10, 0)));
                txRepo.save(tx);
            }
        }
    }

    private void seedExpenses(Long adminId, LocalDate today) {
        Object[][] expenses = {
            // {category, amount, monthsAgo, day}
            {Expense.ExpenseCategory.LUONG_HLV, 15_000_000, 5, 25},
            {Expense.ExpenseCategory.CHI_PHI_VAN_HANH, 2_000_000, 5, 10},
            {Expense.ExpenseCategory.KHAC, 500_000, 5, 15},
            {Expense.ExpenseCategory.LUONG_HLV, 15_000_000, 4, 25},
            {Expense.ExpenseCategory.CHI_PHI_THIET_BI, 3_500_000, 4, 12},
            {Expense.ExpenseCategory.CHI_PHI_VAN_HANH, 2_200_000, 4, 8},
            {Expense.ExpenseCategory.LUONG_HLV, 16_000_000, 3, 25},
            {Expense.ExpenseCategory.CHI_PHI_VAN_HANH, 2_100_000, 3, 5},
            {Expense.ExpenseCategory.CHI_PHI_THIET_BI, 1_200_000, 3, 18},
            {Expense.ExpenseCategory.KHAC, 800_000, 3, 22},
            {Expense.ExpenseCategory.LUONG_HLV, 16_000_000, 2, 25},
            {Expense.ExpenseCategory.CHI_PHI_VAN_HANH, 2_300_000, 2, 7},
            {Expense.ExpenseCategory.CHI_PHI_THIET_BI, 4_500_000, 2, 14},
            {Expense.ExpenseCategory.KHAC, 600_000, 2, 20},
            {Expense.ExpenseCategory.LUONG_HLV, 16_500_000, 1, 25},
            {Expense.ExpenseCategory.CHI_PHI_VAN_HANH, 2_400_000, 1, 6},
            {Expense.ExpenseCategory.CHI_PHI_THIET_BI, 2_800_000, 1, 15},
            {Expense.ExpenseCategory.KHAC, 750_000, 1, 21},
            {Expense.ExpenseCategory.LUONG_HLV, 16_500_000, 0, 20},
            {Expense.ExpenseCategory.CHI_PHI_VAN_HANH, 2_500_000, 0, 5},
            {Expense.ExpenseCategory.CHI_PHI_THIET_BI, 1_800_000, 0, 10},
        };

        for (Object[] e : expenses) {
            Expense exp = new Expense();
            exp.setCategory((Expense.ExpenseCategory) e[0]);
            exp.setAmount(BigDecimal.valueOf(((Number) e[1]).longValue()));
            int monthsAgo = (int) e[2];
            int day = (int) e[3];
            LocalDate expDate = today.minusMonths(monthsAgo).withDayOfMonth(Math.min(day, today.minusMonths(monthsAgo).lengthOfMonth()));
            exp.setExpenseDate(expDate);
            exp.setCreatedBy(adminId);
            exp.setCreatedAt(expDate.atTime(9, 0));
            expenseRepo.save(exp);
        }
    }

    private int dayOffset(String day) {
        return switch (day.trim()) {
            case "MONDAY" -> 0;
            case "TUESDAY" -> 1;
            case "WEDNESDAY" -> 2;
            case "THURSDAY" -> 3;
            case "FRIDAY" -> 4;
            case "SATURDAY" -> 5;
            case "SUNDAY" -> 6;
            default -> 0;
        };
    }

    private UserAccount saveUser(String name, String email, String phone, String pwHash, UserAccount.Role role) {
        UserAccount u = new UserAccount();
        u.setFullName(name);
        u.setEmail(email);
        u.setPhone(phone);
        u.setPasswordHash(pwHash);
        u.setRole(role);
        u.setStatus(UserAccount.Status.ACTIVE);
        return userRepo.save(u);
    }

    private TrainerProfile saveTrainer(UserAccount ua, String specialty, String phone) {
        TrainerProfile t = new TrainerProfile();
        t.setUserAccount(ua);
        t.setSpecialty(specialty);
        t.setContactPhone(phone);
        t.setStatus(TrainerProfile.TrainerStatus.ACTIVE);
        return trainerRepo.save(t);
    }

    private PackageType savePkgType(String name, PackageType.PackageCategory cat, Integer sessions, int days, long price) {
        PackageType pt = new PackageType();
        pt.setName(name);
        pt.setCategory(cat);
        pt.setSessions(sessions);
        pt.setDurationDays(days);
        pt.setPrice(price);
        pt.setStatus(PackageType.PackageStatus.ACTIVE);
        return pkgTypeRepo.save(pt);
    }

    private GymClass saveGymClass(String name, String equipType, Long trainerId, String days, LocalTime start, LocalTime end, int capacity) {
        GymClass gc = new GymClass();
        gc.setName(name);
        gc.setEquipmentType(equipType);
        gc.setTrainerId(trainerId);
        gc.setDaysOfWeek(days);
        gc.setStartTime(start);
        gc.setEndTime(end);
        gc.setCapacity(capacity);
        gc.setStatus(GymClass.GymClassStatus.ACTIVE);
        return gymClassRepo.save(gc);
    }

    private void seedEquipment() {
        for (int i = 1; i <= 8; i++) {
            Equipment eq = new Equipment();
            eq.setCode("REF-0" + i);
            eq.setName("Máy Reformer 0" + i);
            eq.setType("Reformer");
            eq.setLocation(i <= 4 ? "Phòng A" : "Phòng B");
            eq.setStatus(Equipment.EquipmentStatus.ACTIVE);
            equipRepo.save(eq);
        }
        Equipment mat = new Equipment();
        mat.setCode("MAT-01");
        mat.setName("Thảm Mat 01");
        mat.setType("Mat");
        mat.setLocation("Phòng B");
        mat.setStatus(Equipment.EquipmentStatus.ACTIVE);
        equipRepo.save(mat);
    }
}
