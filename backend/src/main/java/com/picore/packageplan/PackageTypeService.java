package com.picore.packageplan;

import com.picore.common.audit.AuditLogService;
import com.picore.common.exception.ApiException;
import com.picore.packageplan.dto.CreatePackageTypeRequest;
import com.picore.packageplan.dto.PackageTypeResponse;
import com.picore.packageplan.dto.UpdatePackageTypeRequest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;

@Service
@Transactional
public class PackageTypeService {

    private static final Set<PackageType.PackageCategory> SESSIONS_REQUIRED = Set.of(
            PackageType.PackageCategory.THEO_BUOI,
            PackageType.PackageCategory.GOI_1_1,
            PackageType.PackageCategory.GOI_1_2
    );

    private final PackageTypeRepository packageTypeRepository;
    private final AuditLogService auditLogService;

    public PackageTypeService(PackageTypeRepository packageTypeRepository,
                              AuditLogService auditLogService) {
        this.packageTypeRepository = packageTypeRepository;
        this.auditLogService = auditLogService;
    }

    @Transactional(readOnly = true)
    public List<PackageTypeResponse> getAllPackageTypes() {
        return packageTypeRepository.findAllByOrderByIdAsc().stream()
                .map(PackageTypeResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<PackageTypeResponse> getActivePackageTypes() {
        return packageTypeRepository
                .findByStatusOrderByIdAsc(PackageType.PackageStatus.ACTIVE).stream()
                .map(PackageTypeResponse::from)
                .toList();
    }

    @Transactional
    public PackageTypeResponse createPackageType(CreatePackageTypeRequest req, Long actorId) {
        PackageType.PackageCategory category = parseCategory(req.category());
        Integer sessions = resolveSessions(category, req.sessions());

        if (packageTypeRepository.existsByName(req.name())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "name", "Tên gói tập đã tồn tại");
        }

        PackageType pt = new PackageType();
        pt.setName(req.name());
        pt.setCategory(category);
        pt.setSessions(sessions);
        pt.setDurationDays(req.durationDays());
        pt.setPrice(req.price());
        pt.setDescription(req.description());
        pt.setStatus(PackageType.PackageStatus.ACTIVE);

        try {
            pt = packageTypeRepository.saveAndFlush(pt);
        } catch (DataIntegrityViolationException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "name", "Tên gói tập đã tồn tại");
        }

        auditLogService.log(actorId, "CREATE_PACKAGE_TYPE", "PackageType", pt.getId(),
                "Tạo loại gói tập: " + pt.getName());

        return PackageTypeResponse.from(pt);
    }

    @Transactional
    public PackageTypeResponse updatePackageType(Long id, UpdatePackageTypeRequest req, Long actorId) {
        PackageType pt = packageTypeRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy loại gói tập"));

        PackageType.PackageCategory category = parseCategory(req.category());
        Integer sessions = resolveSessions(category, req.sessions());

        if (packageTypeRepository.existsByNameAndIdNot(req.name(), id)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "name", "Tên gói tập đã tồn tại");
        }

        pt.setName(req.name());
        pt.setCategory(category);
        pt.setSessions(sessions);
        pt.setDurationDays(req.durationDays());
        pt.setPrice(req.price());
        pt.setDescription(req.description());

        try {
            pt = packageTypeRepository.saveAndFlush(pt);
        } catch (DataIntegrityViolationException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "name", "Tên gói tập đã tồn tại");
        }

        auditLogService.log(actorId, "UPDATE_PACKAGE_TYPE", "PackageType", pt.getId(),
                "Cập nhật loại gói tập: " + pt.getName());

        return PackageTypeResponse.from(pt);
    }

    @Transactional
    public PackageTypeResponse toggleStatus(Long id, Long actorId) {
        PackageType pt = packageTypeRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy loại gói tập"));

        boolean deactivating = pt.getStatus() == PackageType.PackageStatus.ACTIVE;
        pt.setStatus(deactivating
                ? PackageType.PackageStatus.INACTIVE
                : PackageType.PackageStatus.ACTIVE);

        pt = packageTypeRepository.save(pt);

        String verb = deactivating ? "Ngừng áp dụng loại gói tập: " : "Áp dụng lại loại gói tập: ";
        auditLogService.log(actorId, "TOGGLE_PACKAGE_TYPE_STATUS", "PackageType", pt.getId(),
                verb + pt.getName());

        return PackageTypeResponse.from(pt);
    }

    private PackageType.PackageCategory parseCategory(String category) {
        if (category == null || category.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "category", "Phân loại không hợp lệ");
        }
        try {
            return PackageType.PackageCategory.valueOf(category.trim());
        } catch (IllegalArgumentException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "category", "Phân loại không hợp lệ");
        }
    }

    private Integer resolveSessions(PackageType.PackageCategory category, Integer sessions) {
        if (SESSIONS_REQUIRED.contains(category)) {
            if (sessions == null) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "sessions",
                        "Số buổi là bắt buộc với loại gói này");
            }
            if (sessions <= 0) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "sessions",
                        "Số buổi phải lớn hơn 0");
            }
            return sessions;
        }
        // THEO_THANG / KHONG_GIOI_HAN: ignore input, force null
        return null;
    }
}
