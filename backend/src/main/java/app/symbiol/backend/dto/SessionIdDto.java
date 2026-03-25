package app.symbiol.backend.dto;

public class SessionIdDto {

    private String publicId;

    public SessionIdDto(String publicId) {
        this.publicId = publicId;
    }

    public String getId() {
        return publicId;
    }
}

