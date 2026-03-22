package app.symbiol.backend.dto;

public class UploadSessionJwtDto {

    private String token;
    private Long sessionId;

    public UploadSessionJwtDto(String token, Long sessionId) {
        this.token = token;
        this.sessionId = sessionId;
    }
    
    public String getToken() { return this.token; }
    public Long getSessionId() { return this.sessionId; }
}
