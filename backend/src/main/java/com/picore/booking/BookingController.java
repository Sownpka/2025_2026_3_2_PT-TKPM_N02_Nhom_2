package com.picore.booking;

import com.picore.booking.dto.BookingResponse;
import com.picore.booking.dto.CreateBookingRequest;
import com.picore.booking.dto.JoinWaitlistRequest;
import com.picore.common.exception.ApiException;
import com.picore.common.security.UserPrincipal;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * API đặt & hủy lịch tập (UC5.1). Context-path /api.
 * POST /api/bookings, DELETE /api/bookings/{id}, POST /api/waitlist.
 */
@RestController
public class BookingController {

    private final BookingService bookingService;

    public BookingController(BookingService bookingService) {
        this.bookingService = bookingService;
    }

    @PostMapping("/bookings")
    @PreAuthorize("hasAnyRole('MEMBER','RECEPTIONIST')")
    public ResponseEntity<BookingResponse> book(
            @RequestBody CreateBookingRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        if (request == null || request.classSessionId() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "classSessionId", "Thiếu buổi tập cần đặt");
        }

        BookingResponse response;
        if ("RECEPTIONIST".equals(principal.role())) {
            if (request.memberId() == null) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "memberId",
                        "Lễ tân cần chỉ định hội viên (memberId) khi đặt hộ");
            }
            response = bookingService.bookSessionForMember(
                    request.memberId(), request.classSessionId(), request.memberPackageId());
        } else {
            response = bookingService.bookSession(
                    principal.id(), request.classSessionId(), request.memberPackageId());
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @DeleteMapping("/bookings/{id}")
    @PreAuthorize("hasAnyRole('MEMBER','RECEPTIONIST')")
    public ResponseEntity<Void> cancel(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal principal) {
        if ("RECEPTIONIST".equals(principal.role())) {
            bookingService.cancelBookingAsStaff(id);
        } else {
            bookingService.cancelBooking(principal.id(), id);
        }
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/waitlist")
    @PreAuthorize("hasRole('MEMBER')")
    public ResponseEntity<Void> joinWaitlist(
            @RequestBody JoinWaitlistRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        if (request == null || request.classSessionId() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "classSessionId", "Thiếu buổi tập");
        }
        bookingService.joinWaitlist(principal.id(), request.classSessionId());
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }
}
