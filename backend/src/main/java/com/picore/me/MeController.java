package com.picore.me;

import com.picore.booking.BookingService;
import com.picore.common.security.UserPrincipal;
import com.picore.me.dto.MyBookingItem;
import com.picore.me.dto.MyHistoryItem;
import com.picore.me.dto.MyPackageResponse;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

/**
 * Khu vực "của tôi" cho hội viên (UC2.2). userId luôn lấy từ SecurityContext.
 * Context-path /api => endpoints: /api/me/packages, /api/me/history.
 */
@RestController
@RequestMapping("/me")
@PreAuthorize("hasRole('MEMBER')")
public class MeController {

    private final MeService meService;
    private final BookingService bookingService;

    public MeController(MeService meService, BookingService bookingService) {
        this.meService = meService;
        this.bookingService = bookingService;
    }

    @GetMapping("/packages")
    public ResponseEntity<List<MyPackageResponse>> myPackages(
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(meService.getMyPackages(principal.id()));
    }

    @GetMapping("/history")
    public ResponseEntity<List<MyHistoryItem>> myHistory(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(name = "filter", defaultValue = "MONTH") MeService.HistoryFilter filter,
            @RequestParam(name = "from", required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(name = "to", required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(meService.getMyHistory(principal.id(), filter, from, to));
    }

    @GetMapping("/bookings")
    public ResponseEntity<List<MyBookingItem>> myBookings(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(name = "status", defaultValue = "UPCOMING") String status) {
        return ResponseEntity.ok(bookingService.getMyBookings(principal.id(), status));
    }
}
