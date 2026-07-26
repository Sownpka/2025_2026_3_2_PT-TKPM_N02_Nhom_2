package com.picore.equipment;

import com.picore.common.audit.AuditLogService;
import com.picore.common.exception.ApiException;
import com.picore.equipment.dto.CreateEquipmentRequest;
import com.picore.equipment.dto.EquipmentResponse;
import com.picore.equipment.dto.EquipmentTypeCount;
import com.picore.equipment.dto.UpdateEquipmentRequest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class EquipmentService {

    private final EquipmentRepository equipmentRepository;
    private final AuditLogService auditLogService;

    public EquipmentService(EquipmentRepository equipmentRepository,
                            AuditLogService auditLogService) {
        this.equipmentRepository = equipmentRepository;
        this.auditLogService = auditLogService;
    }

    @Transactional(readOnly = true)
    public List<EquipmentResponse> getEquipment(boolean includeInactive) {
        List<Equipment> list = includeInactive
                ? equipmentRepository.findAllByOrderByIdAsc()
                : equipmentRepository.findByStatusOrderByIdAsc(Equipment.EquipmentStatus.ACTIVE);
        return list.stream().map(EquipmentResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<EquipmentTypeCount> countByType() {
        return equipmentRepository.countByType();
    }

    @Transactional
    public EquipmentResponse create(CreateEquipmentRequest req, Long actorId) {
        String code = req.code() != null ? req.code().trim() : null;

        if (equipmentRepository.existsByCode(code)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "code", "Mã thiết bị đã tồn tại");
        }

        Equipment e = new Equipment();
        e.setCode(code);
        e.setName(req.name());
        e.setType(req.type());
        e.setLocation(req.location());
        e.setNote(req.note());
        e.setStatus(Equipment.EquipmentStatus.ACTIVE);

        try {
            e = equipmentRepository.saveAndFlush(e);
        } catch (DataIntegrityViolationException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "code", "Mã thiết bị đã tồn tại");
        }

        auditLogService.log(actorId, "CREATE_EQUIPMENT", "equipment", e.getId(),
                "Tạo thiết bị: " + e.getCode() + " - " + e.getName());

        return EquipmentResponse.from(e);
    }

    @Transactional
    public EquipmentResponse update(Long id, UpdateEquipmentRequest req, Long actorId) {
        Equipment e = equipmentRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy thiết bị"));

        // Không cho phép sửa code — chỉ cập nhật các trường còn lại.
        e.setName(req.name());
        e.setType(req.type());
        e.setLocation(req.location());
        e.setNote(req.note());

        e = equipmentRepository.save(e);

        auditLogService.log(actorId, "UPDATE_EQUIPMENT", "equipment", e.getId(),
                "Cập nhật thiết bị: " + e.getCode() + " - " + e.getName());

        return EquipmentResponse.from(e);
    }

    @Transactional
    public EquipmentResponse deactivate(Long id, Long actorId) {
        Equipment e = equipmentRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy thiết bị"));

        // Soft delete: đổi status = INACTIVE, không xóa vật lý.
        e.setStatus(Equipment.EquipmentStatus.INACTIVE);
        e = equipmentRepository.save(e);

        auditLogService.log(actorId, "DEACTIVATE_EQUIPMENT", "equipment", e.getId(),
                "Ngừng hoạt động thiết bị: " + e.getCode() + " - " + e.getName());

        return EquipmentResponse.from(e);
    }
}
