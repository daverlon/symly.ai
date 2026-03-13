package app.symbiol.backend.dto;

public class UserDto {
    private String username;

    public UserDto(String username) {
        this.username = username;
    }
    
    public String getUsernaem() { return username; }
}
