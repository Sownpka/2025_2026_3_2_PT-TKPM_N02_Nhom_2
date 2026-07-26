package com.picore.attendance;

import com.picore.attendance.dto.AttendeeItem;
import com.picore.attendance.dto.CheckInResponse;
import com.picore.attendance.dto.QuickCheckinRequest;
import com.picore.attendance.dto.QuickCheckinResponse;
import com.picore.attendance.dto.SessionSummary;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * API điểm danh buổi học (UC5.3). Context-path /api → base path /api/attendance.
 * Toàn bộ endpoint chỉ dành cho RECEPTIONIST.
 */
@RestController
@RequestMapping("/attendance")
@PreAuthorize("hasRole('RECEPTIONIST') or hasRole('ADMIN')")
public class AttendanceController {

    private final AttendanceService attendanceService;

    public AttendanceController(AttendanceService attendanceService) {
        this.attendanceService = attendanceService;
    }

    @GetMapping("/today")
    public List<SessionSummary> getTodaySessions() {
        return attendanceService.getTodaySessions();
    }

    @GetMapping("/{sessionId}/attendees")
    public List<AttendeeItem> getAttendees(@PathVariable Long sessionId) {
        return attendanceService.getAttendees(sessionId);
    }

    @PostMapping("/{bookingId}/check-in")
    public CheckInResponse checkIn(@PathVariable Long bookingId) {
        return attendanceService.checkIn(bookingId);
    }

    @PostMapping("/{bookingId}/no-show")
    public CheckInResponse markNoShow(@PathVariable Long bookingId) {
        return attendanceService.markNoShow(bookingId);
    }

    @PostMapping("/quick-checkin")
    public QuickCheckinResponse quickCheckin(@RequestBody QuickCheckinRequest request) {
        return attendanceService.quickCheckin(request == null ? null : request.phone());
    }
}
