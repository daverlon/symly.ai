package app.symbiol.backend.dto;

public class UploadSessionJwtDto {

    private String uploadSessionJwt;
    private Long sessionId;

    public UploadSessionJwtDto(String uploadSessionJwt, Long sessionId) {
        this.uploadSessionJwt = uploadSessionJwt;
        this.sessionId = sessionId;
    }
    
    public String getUploadSessionJwt() { return this.uploadSessionJwt; }
    public Long getSessionId() { return this.sessionId; }
}
