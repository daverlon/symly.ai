package app.symbiol.backend.dto;

public class UploadSessionJwtDto {

    private String token;

    public UploadSessionJwtDto(String token) {
        this.token = token;
    }
    
    public String getToken() { return this.token; }
}
