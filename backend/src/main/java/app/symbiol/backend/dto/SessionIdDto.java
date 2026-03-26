package app.symbiol.backend.dto;

import java.time.Instant;

public class SessionIdDto {

    private String publicId;
    private Instant creationDate;

    public SessionIdDto(String publicId, Instant creationDate) {
        this.publicId = publicId;
        this.creationDate = creationDate;
    }

    public String getId() {
        return publicId;
    }

    public Instant getCreationDate() { return this.creationDate; }
}

