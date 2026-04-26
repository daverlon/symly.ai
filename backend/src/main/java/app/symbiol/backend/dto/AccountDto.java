package app.symbiol.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class AccountDto {

    @NotBlank(message = "Username is required")
    @Size(min = 3, max = 50, message = "Username must be between 3 and 50 characters")
    private String username;

    @NotBlank(message = "Password is required")
    @Size(min = 5, max = 128, message = "Password must be between 5 and 128 characters")
    private String password;

    public AccountDto(String username, String password) {
        this.username = username;
        this.password = password;
    }

    public String getUsername() { return this.username; }
    public String getPassword() { return this.password; }
}
