package com.picore.packageplan;

import com.picore.common.security.UserPrincipal;
import com.picore.packageplan.dto.CreatePackageTypeRequest;
import com.picore.packageplan.dto.PackageTypeResponse;
import com.picore.packageplan.dto.UpdatePackageTypeRequest;
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
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/package-types")
public class PackageTypeController {

    private final PackageTypeService packageTypeService;

    public PackageTypeController(PackageTypeService packageTypeService) {
        this.packageTypeService = packageTypeService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','RECEPTIONIST')")
    public ResponseEntity<List<PackageTypeResponse>> getAll() {
        return ResponseEntity.ok(packageTypeService.getAllPackageTypes());
    }

    @GetMapping("/active")
    @PreAuthorize("hasAnyRole('ADMIN','RECEPTIONIST')")
    public ResponseEntity<List<PackageTypeResponse>> getActive() {
        return ResponseEntity.ok(packageTypeService.getActivePackageTypes());
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<PackageTypeResponse> create(
            @Valid @RequestBody CreatePackageTypeRequest request,
            Authentication auth) {
        PackageTypeResponse response = packageTypeService.createPackageType(request, actorId(auth));
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<PackageTypeResponse> update(
            @PathVariable Long id,
            @Valid @RequestBody UpdatePackageTypeRequest request,
            Authentication auth) {
        return ResponseEntity.ok(packageTypeService.updatePackageType(id, request, actorId(auth)));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<PackageTypeResponse> toggleStatus(
            @PathVariable Long id,
            Authentication auth) {
        return ResponseEntity.ok(packageTypeService.toggleStatus(id, actorId(auth)));
    }

    private Long actorId(Authentication auth) {
        return ((UserPrincipal) auth.getPrincipal()).id();
    }
}
