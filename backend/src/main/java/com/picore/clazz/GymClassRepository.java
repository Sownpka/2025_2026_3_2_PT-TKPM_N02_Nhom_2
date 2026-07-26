package com.picore.clazz;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * Repository cho GymClass. UC4.1 mở rộng thêm query CRUD + kiểm tra trùng tên.
 * UC4.3 dùng findAllById để resolve tên lớp cho lưới ca làm việc.
 */
public interface GymClassRepository extends JpaRepository<GymClass, Long> {

    List<GymClass> findAllByStatusOrderByIdAsc(GymClass.GymClassStatus status);

    boolean existsByName(String name);

    boolean existsByNameAndIdNot(String name, Long id);
}
