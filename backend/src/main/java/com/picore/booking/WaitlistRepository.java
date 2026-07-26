package com.picore.booking;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface WaitlistRepository extends JpaRepository<Waitlist, Long> {

    List<Waitlist> findByClassSessionIdOrderByCreatedAtAsc(Long classSessionId);

    boolean existsByClassSessionIdAndMemberId(Long classSessionId, Long memberId);

    Optional<Waitlist> findFirstByClassSessionIdAndNotifiedFalseOrderByCreatedAtAsc(Long classSessionId);
}
