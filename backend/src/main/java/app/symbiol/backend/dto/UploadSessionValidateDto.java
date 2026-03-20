package app.symbiol.backend.dto;

public class UploadSessionValidateDto {

    private Long sessionId;

    public UploadSessionValidateDto(Long sessionId) {
        this.sessionId = sessionId;
    }

    public Long getSessionId() {
        return sessionId;
    }
}

