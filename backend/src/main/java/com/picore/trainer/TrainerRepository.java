package com.picore.trainer;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TrainerRepository extends JpaRepository<TrainerProfile, Long> {

    List<TrainerProfile> findAllByStatusOrderByIdAsc(TrainerProfile.TrainerStatus status);

    boolean existsByUserAccountId(Long userAccountId);

    Optional<TrainerProfile> findByUserAccountId(Long userAccountId);
}
