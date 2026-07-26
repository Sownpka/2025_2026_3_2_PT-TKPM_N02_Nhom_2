package com.picore.packageplan;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PackageTypeRepository extends JpaRepository<PackageType, Long> {

    boolean existsByName(String name);

    boolean existsByNameAndIdNot(String name, Long id);

    List<PackageType> findAllByOrderByIdAsc();

    List<PackageType> findByStatusOrderByIdAsc(PackageType.PackageStatus status);
}
