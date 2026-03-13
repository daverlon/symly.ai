package app.symbiol.backend.dto;

public class AccountDto {
    private String username;
    private String password;

    public AccountDto(String username, String password) {
        this.username = username;
        this.password = password;
    }

    public String getUsername() { return this.username; }
    public String getPassword() { return this.password; }
}
