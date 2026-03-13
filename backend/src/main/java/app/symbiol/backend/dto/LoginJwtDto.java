package app.symbiol.backend.dto;

public class LoginJwtDto {
    private String token;

    public LoginJwtDto(String token) {
        this.token = token;
    }

    public String getToken() { return this.token; }
}
