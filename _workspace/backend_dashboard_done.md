# Backend Dashboard + RBAC — Kết quả

Ngày: 2026-07-19

## Files đã sửa/tạo

1. **Sửa** `backend/src/main/java/com/picore/member/MemberController.java`
   - Class-level `@PreAuthorize` từ `hasRole('RECEPTIONIST')` → `hasRole('RECEPTIONIST') or hasRole('ADMIN')`

2. **Sửa** `backend/src/main/java/com/picore/attendance/AttendanceController.java`
   - Class-level `@PreAuthorize` từ `hasRole('RECEPTIONIST')` → `hasRole('RECEPTIONIST') or hasRole('ADMIN')`

3. **Tạo mới** `backend/src/main/java/com/picore/common/DashboardController.java`
   - `@RestController @RequestMapping("/dashboard") @PreAuthorize("hasRole('ADMIN')")`
   - Endpoint: `GET /api/dashboard` (context-path `/api`)
   - Inject 7 repository qua constructor
   - Inner record `DashboardStats(totalMembers, totalActivePackages, totalTrainers, totalEquipment, revenueThisMonth, expenseThisMonth, sessionsTodayCount)`

## Cách query (dùng method có sẵn, không tạo duplicate)

| Field | Nguồn |
|-------|-------|
| totalMembers | `MemberRepository.findAll().stream().filter(status==ACTIVE).count()` (repo chưa có countByStatus) |
| totalActivePackages | `MemberPackageRepository.findAll().stream().filter(status==ACTIVE).count()` (repo chưa có countByStatus) |
| totalTrainers | `TrainerRepository.findAllByStatusOrderByIdAsc(ACTIVE).size()` (method có sẵn) |
| totalEquipment | `EquipmentRepository.findByStatusOrderByIdAsc(ACTIVE).size()` (method có sẵn) |
| revenueThisMonth | `PackageTransactionRepository.sumAmountByCreatedAtBetween(monthStart, monthEnd)` → Long (method có sẵn) |
| expenseThisMonth | `ExpenseRepository.sumAmountByExpenseDateBetween(firstDay, lastDay)` → BigDecimal.longValue() (method có sẵn) |
| sessionsTodayCount | `ClassSessionRepository.findBySessionDateOrderByStartTimeAsc(today).size()` (method có sẵn) |

Không thêm method mới vào bất kỳ repository nào → không có duplicate.

## Compile result

```
cd D:\Pi-core\backend && mvn compile -q
EXIT: 0  (BUILD SUCCESS, không có lỗi)
```
