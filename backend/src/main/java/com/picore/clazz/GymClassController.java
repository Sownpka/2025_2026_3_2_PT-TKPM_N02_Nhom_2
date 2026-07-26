package com.picore.clazz;

import com.picore.clazz.dto.CreateClassRequest;
import com.picore.clazz.dto.GymClassResponse;
import com.picore.clazz.dto.TimetableResponse;
import com.picore.clazz.dto.UpdateClassRequest;
import com.picore.common.security.UserPrincipal;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class GymClassController {

    private final GymClassService gymClassService;

    public GymClassController(GymClassService gymClassService) {
        this.gymClassService = gymClassService;
    }

    @GetMapping("/classes")
    @PreAuthorize("hasAnyRole('ADMIN','RECEPTIONIST')")
    public ResponseEntity<List<GymClassResponse>> getAll() {
        return ResponseEntity.ok(gymClassService.getAll());
    }

    @PostMapping("/classes")
    @PreAuthorize("hasAnyRole('ADMIN','RECEPTIONIST')")
    public ResponseEntity<GymClassResponse> create(
            @Valid @RequestBody CreateClassRequest request,
            Authentication auth) {
        GymClassResponse response = gymClassService.create(request, actorId(auth));
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PutMapping("/classes/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','RECEPTIONIST')")
    public ResponseEntity<GymClassResponse> update(
            @PathVariable Long id,
            @Valid @RequestBody UpdateClassRequest request,
            Authentication auth) {
        return ResponseEntity.ok(gymClassService.update(id, request, actorId(auth)));
    }

    @PatchMapping("/classes/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN','RECEPTIONIST')")
    public ResponseEntity<GymClassResponse> deactivate(
            @PathVariable Long id,
            Authentication auth) {
        return ResponseEntity.ok(gymClassService.deactivate(id, actorId(auth)));
    }

    @GetMapping("/timetable")
    @PreAuthorize("hasAnyRole('ADMIN','RECEPTIONIST','MEMBER')")
    public ResponseEntity<TimetableResponse> getTimetable(
            @RequestParam(name = "week", required = false) String week,
            Authentication auth) {
        // Chỉ MEMBER mới cần myBookingStatus; ADMIN/RECEPTIONIST → null.
        UserPrincipal principal = (UserPrincipal) auth.getPrincipal();
        Long currentUserId = "MEMBER".equals(principal.role()) ? principal.id() : null;
        return ResponseEntity.ok(gymClassService.getTimetable(week, currentUserId));
    }

    private Long actorId(Authentication auth) {
        return ((UserPrincipal) auth.getPrincipal()).id();
    }
}
