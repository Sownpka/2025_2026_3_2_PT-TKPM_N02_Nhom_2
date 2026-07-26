package com.picore.equipment;

import com.picore.equipment.dto.EquipmentTypeCount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface EquipmentRepository extends JpaRepository<Equipment, Long> {

    boolean existsByCode(String code);

    List<Equipment> findAllByOrderByIdAsc();

    List<Equipment> findByStatusOrderByIdAsc(Equipment.EquipmentStatus status);

    // Đếm số thiết bị ACTIVE theo loại — cơ sở tham chiếu sức chứa tối đa (UC4.1)
    @Query("""
            SELECT new com.picore.equipment.dto.EquipmentTypeCount(e.type, COUNT(e))
            FROM Equipment e
            WHERE e.status = com.picore.equipment.Equipment.EquipmentStatus.ACTIVE
            GROUP BY e.type
            ORDER BY e.type ASC
            """)
    List<EquipmentTypeCount> countByType();
}
