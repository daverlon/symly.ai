package app.symbiol.backend.api.auth;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import app.symbiol.backend.dto.AccountDto;
import app.symbiol.backend.service.AccountService;

@RestController
@RequestMapping("/api/auth/login")
public class LoginController {

    public final AccountService accountService;

    public LoginController(AccountService accountService) {
        this.accountService = accountService;
    }

    @PostMapping
    public ResponseEntity<String> login(@RequestBody AccountDto dto) {
        accountService.validateAccount(dto.getUsername(), dto.getPassword());
        return ResponseEntity.status(200).body("Login validted");
    }
    
}
