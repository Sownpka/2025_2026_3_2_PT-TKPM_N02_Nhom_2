package com.picore.auth;

import com.picore.auth.dto.AccountResponse;
import com.picore.auth.dto.CreateAccountRequest;
import com.picore.auth.dto.UpdateAccountRequest;
import com.picore.common.security.UserPrincipal;
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
@RequestMapping("/accounts")
@PreAuthorize("hasRole('ADMIN')")
public class AccountController {

    private final AccountService accountService;

    public AccountController(AccountService accountService) {
        this.accountService = accountService;
    }

    @GetMapping
    public ResponseEntity<List<AccountResponse>> getAllAccounts(
            @RequestParam(name = "search", required = false) String search) {
        return ResponseEntity.ok(accountService.getAllAccounts(search));
    }

    @PostMapping
    public ResponseEntity<AccountResponse> createAccount(
            @Valid @RequestBody CreateAccountRequest request,
            Authentication auth) {
        AccountResponse response = accountService.createAccount(request, actorId(auth));
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PutMapping("/{id}")
    public ResponseEntity<AccountResponse> updateAccount(
            @PathVariable Long id,
            @Valid @RequestBody UpdateAccountRequest request,
            Authentication auth) {
        return ResponseEntity.ok(accountService.updateAccount(id, request, actorId(auth)));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<AccountResponse> toggleStatus(
            @PathVariable Long id,
            Authentication auth) {
        return ResponseEntity.ok(accountService.toggleStatus(id, actorId(auth)));
    }

    private Long actorId(Authentication auth) {
        return ((UserPrincipal) auth.getPrincipal()).id();
    }
}
