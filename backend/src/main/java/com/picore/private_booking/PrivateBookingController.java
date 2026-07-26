package com.picore.private_booking;

import com.picore.booking.dto.BookingResponse;
import com.picore.common.security.UserPrincipal;
import com.picore.private_booking.dto.CreatePrivateBookingRequest;
import com.picore.private_booking.dto.PrivateSlotsResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * UC5.2 — API đăng ký buổi tập 1-1 / 1-2. Context-path /api.
 * GET /api/private-booking/slots, POST /api/private-booking.
 */
@RestController
@RequestMapping("/private-booking")
public class PrivateBookingController {

    private final PrivateBookingService privateBookingService;

    public PrivateBookingController(PrivateBookingService privateBookingService) {
        this.privateBookingService = privateBookingService;
    }

    @GetMapping("/slots")
    @PreAuthorize("hasRole('MEMBER')")
    public ResponseEntity<PrivateSlotsResponse> getSlots(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) String week) {
        return ResponseEntity.ok(privateBookingService.getSlots(principal.id(), week));
    }

    @PostMapping
    @PreAuthorize("hasRole('MEMBER')")
    public ResponseEntity<BookingResponse> create(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestBody CreatePrivateBookingRequest request) {
        BookingResponse response =
                privateBookingService.createPrivateBooking(principal.id(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
}
