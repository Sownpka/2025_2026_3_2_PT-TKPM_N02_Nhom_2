package com.picore.memberpackage;

import com.picore.common.security.UserPrincipal;
import com.picore.memberpackage.dto.MemberPackageResponse;
import com.picore.memberpackage.dto.RegisterPackageRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@PreAuthorize("hasRole('RECEPTIONIST')")
public class MemberPackageController {

    private final MemberPackageService memberPackageService;

    public MemberPackageController(MemberPackageService memberPackageService) {
        this.memberPackageService = memberPackageService;
    }

    @PostMapping("/member-packages")
    public ResponseEntity<MemberPackageResponse> registerPackage(
            @Valid @RequestBody RegisterPackageRequest request,
            Authentication auth) {
        MemberPackageResponse response = memberPackageService.registerPackage(request, actorId(auth));
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/members/{id}/packages")
    public ResponseEntity<List<MemberPackageResponse>> getMemberPackages(@PathVariable Long id) {
        return ResponseEntity.ok(memberPackageService.getMemberPackages(id));
    }

    private Long actorId(Authentication auth) {
        return ((UserPrincipal) auth.getPrincipal()).id();
    }
}
