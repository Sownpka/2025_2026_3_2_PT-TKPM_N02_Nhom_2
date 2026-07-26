package com.picore.trainer;

import com.picore.common.security.UserPrincipal;
import com.picore.trainer.dto.SessionAttendeesResponse;
import com.picore.trainer.dto.TrainerScheduleResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * UC4.4 — Lịch dạy của HLV. Context-path /api => GET /api/trainer/schedule.
 * trainerId luôn suy ra từ userId trong JWT (SecurityContext).
 */
@RestController
@RequestMapping("/trainer")
@PreAuthorize("hasRole('TRAINER')")
public class TrainerScheduleController {

    private final TrainerScheduleService trainerScheduleService;

    public TrainerScheduleController(TrainerScheduleService trainerScheduleService) {
        this.trainerScheduleService = trainerScheduleService;
    }

    @GetMapping("/schedule")
    public ResponseEntity<TrainerScheduleResponse> getSchedule(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(name = "week", required = false) String week) {
        return ResponseEntity.ok(trainerScheduleService.getSchedule(principal.id(), week));
    }

    /**
     * UC5.5 — Danh sách học viên của 1 buổi học. GET /api/trainer/sessions/{sessionId}/attendees.
     * Service kiểm tra buổi học thuộc HLV đang đăng nhập (403 nếu không phải).
     */
    @GetMapping("/sessions/{sessionId}/attendees")
    public SessionAttendeesResponse getSessionAttendees(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long sessionId) {
        return trainerScheduleService.getSessionAttendees(principal.id(), sessionId);
    }
}
