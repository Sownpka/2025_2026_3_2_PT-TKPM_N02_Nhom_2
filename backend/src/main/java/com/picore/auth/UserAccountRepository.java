package com.picore.auth;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserAccountRepository extends JpaRepository<UserAccount, Long> {

    Optional<UserAccount> findByEmail(String email);

    Optional<UserAccount> findByResetToken(String resetToken);

    boolean existsByEmail(String email);

    List<UserAccount> findByFullNameContainingIgnoreCaseOrEmailContainingIgnoreCase(String name, String email);
}
