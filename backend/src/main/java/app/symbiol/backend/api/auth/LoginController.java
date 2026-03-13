package app.symbiol.backend.api.auth;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import app.symbiol.backend.dto.AccountDto;
import app.symbiol.backend.dto.LoginJwtDto;
import app.symbiol.backend.security.JwtService;
import app.symbiol.backend.service.AccountService;

@RestController
@RequestMapping("/auth/login")
public class LoginController {

    public final AccountService accountService;
    public final JwtService jwtService;

    public LoginController(AccountService accountService, JwtService jwtService) {
        this.accountService = accountService;
        this.jwtService = jwtService;
    }

    @PostMapping
    public ResponseEntity<LoginJwtDto> login(@RequestBody AccountDto dto) {
        accountService.authenticateAccount(dto.getUsername(), dto.getPassword());
        String jwt = jwtService.generateToken(dto.getUsername());
        return ResponseEntity.ok(new LoginJwtDto(jwt));
    }
    
}
