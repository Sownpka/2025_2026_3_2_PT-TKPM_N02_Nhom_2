package com.picore.member;

import com.picore.common.security.UserPrincipal;
import com.picore.member.dto.CreateMemberRequest;
import com.picore.member.dto.MemberDetailResponse;
import com.picore.member.dto.MemberResponse;
import com.picore.member.dto.UpdateMemberRequest;
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
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/members")
@PreAuthorize("hasRole('RECEPTIONIST') or hasRole('ADMIN')")
public class MemberController {

    private final MemberService memberService;

    public MemberController(MemberService memberService) {
        this.memberService = memberService;
    }

    @GetMapping
    public ResponseEntity<List<MemberResponse>> getAllMembers(
            @RequestParam(name = "search", required = false) String search) {
        return ResponseEntity.ok(memberService.getAllMembers(search));
    }

    @GetMapping("/search")
    public ResponseEntity<List<MemberResponse>> searchMembers(
            @RequestParam(name = "q", required = false) String q) {
        return ResponseEntity.ok(memberService.searchActiveMembers(q));
    }

    @GetMapping("/without-account")
    public ResponseEntity<List<MemberResponse>> getMembersWithoutAccount() {
        return ResponseEntity.ok(memberService.getMembersWithoutAccount());
    }

    @PostMapping
    public ResponseEntity<MemberResponse> createMember(
            @Valid @RequestBody CreateMemberRequest request,
            Authentication auth) {
        MemberResponse response = memberService.createMember(request, actorId(auth));
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PutMapping("/{id}")
    public ResponseEntity<MemberResponse> updateMember(
            @PathVariable Long id,
            @Valid @RequestBody UpdateMemberRequest request,
            Authentication auth) {
        return ResponseEntity.ok(memberService.updateMember(id, request, actorId(auth)));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<MemberResponse> toggleStatus(
            @PathVariable Long id,
            Authentication auth) {
        return ResponseEntity.ok(memberService.toggleStatus(id, actorId(auth)));
    }

    @GetMapping("/{id}/history")
    public ResponseEntity<MemberDetailResponse> getMemberDetail(
            @PathVariable Long id) {
        return ResponseEntity.ok(memberService.getMemberDetail(id));
    }

    private Long actorId(Authentication auth) {
        return ((UserPrincipal) auth.getPrincipal()).id();
    }
}
