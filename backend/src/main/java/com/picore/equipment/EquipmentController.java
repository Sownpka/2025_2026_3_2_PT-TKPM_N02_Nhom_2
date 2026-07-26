package com.picore.equipment;

import com.picore.common.security.UserPrincipal;
import com.picore.equipment.dto.CreateEquipmentRequest;
import com.picore.equipment.dto.EquipmentResponse;
import com.picore.equipment.dto.EquipmentTypeCount;
import com.picore.equipment.dto.UpdateEquipmentRequest;
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
@RequestMapping("/equipment")
public class EquipmentController {

    private final EquipmentService equipmentService;

    public EquipmentController(EquipmentService equipmentService) {
        this.equipmentService = equipmentService;
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<EquipmentResponse>> getAll(
            @RequestParam(name = "includeInactive", defaultValue = "false") boolean includeInactive) {
        return ResponseEntity.ok(equipmentService.getEquipment(includeInactive));
    }

    @GetMapping("/count-by-type")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<EquipmentTypeCount>> countByType() {
        return ResponseEntity.ok(equipmentService.countByType());
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<EquipmentResponse> create(
            @Valid @RequestBody CreateEquipmentRequest request,
            Authentication auth) {
        EquipmentResponse response = equipmentService.create(request, actorId(auth));
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<EquipmentResponse> update(
            @PathVariable Long id,
            @Valid @RequestBody UpdateEquipmentRequest request,
            Authentication auth) {
        return ResponseEntity.ok(equipmentService.update(id, request, actorId(auth)));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<EquipmentResponse> deactivate(
            @PathVariable Long id,
            Authentication auth) {
        return ResponseEntity.ok(equipmentService.deactivate(id, actorId(auth)));
    }

    private Long actorId(Authentication auth) {
        return ((UserPrincipal) auth.getPrincipal()).id();
    }
}
