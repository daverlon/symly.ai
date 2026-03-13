package app.symbiol.backend.dto;

public class SignupResponseDto {
    private String message;

    public SignupResponseDto(String message) {
        this.message = message;
    }

    public String getMessage() { return this.message; }
}
