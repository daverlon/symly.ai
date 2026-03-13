package app.symbiol.backend.api;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import app.symbiol.backend.dto.AccountDto;
import app.symbiol.backend.service.AccountService;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/accounts")
public class AccountController {

    public final AccountService accountService;

    public AccountController(AccountService accountService) {
        this.accountService = accountService;
    }

    @PostMapping
    public ResponseEntity<String> createaccount(@RequestBody AccountDto dto) {
        log.info("Attempt to create account with username " + dto.getUsername());
        accountService.createAccount(dto.getUsername(), dto.getPassword());
        return ResponseEntity.status(200).body("Account created");
    }

}
