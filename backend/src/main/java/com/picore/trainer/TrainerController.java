package com.picore.trainer;

import com.picore.common.security.UserPrincipal;
import com.picore.trainer.dto.AvailableAccountResponse;
import com.picore.trainer.dto.AvailableTrainerResponse;
import com.picore.trainer.dto.CreateTrainerRequest;
import com.picore.trainer.dto.TrainerResponse;
import com.picore.trainer.dto.TrainerShiftsResponse;
import com.picore.trainer.dto.UpdateTrainerRequest;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
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
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalTime;
import java.util.List;

@RestController
@RequestMapping("/trainers")
public class TrainerController {

    private final TrainerService trainerService;

    public TrainerController(TrainerService trainerService) {
        this.trainerService = trainerService;
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<TrainerResponse>> getAll() {
        return ResponseEntity.ok(trainerService.getAll());
    }

    @GetMapping("/available-accounts")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<AvailableAccountResponse>> getAvailableAccounts() {
        return ResponseEntity.ok(trainerService.getAvailableAccounts());
    }

    @GetMapping("/available-for-class")
    @PreAuthorize("hasAnyRole('ADMIN','RECEPTIONIST')")
    public ResponseEntity<List<AvailableTrainerResponse>> getAvailableForClass(
            @RequestParam List<String> days,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.TIME) LocalTime startTime,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.TIME) LocalTime endTime) {
        return ResponseEntity.ok(trainerService.getAvailableForClass(days, startTime, endTime));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<TrainerResponse> create(
            @Valid @RequestBody CreateTrainerRequest request,
            Authentication auth) {
        TrainerResponse response = trainerService.create(request, actorId(auth));
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<TrainerResponse> update(
            @PathVariable Long id,
            @Valid @RequestBody UpdateTrainerRequest request,
            Authentication auth) {
        return ResponseEntity.ok(trainerService.update(id, request, actorId(auth)));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<TrainerResponse> deactivate(
            @PathVariable Long id,
            Authentication auth) {
        return ResponseEntity.ok(trainerService.deactivate(id, actorId(auth)));
    }

    @GetMapping("/{id}/shifts")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<TrainerShiftsResponse> getShifts(
            @PathVariable Long id,
            @RequestParam(name = "week", required = false) String week) {
        return ResponseEntity.ok(trainerService.getShifts(id, week));
    }

    private Long actorId(Authentication auth) {
        return ((UserPrincipal) auth.getPrincipal()).id();
    }
}
