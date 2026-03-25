package app.symbiol.backend.dto;

import java.time.Instant;

public class UploadSessionDto {
    private String publicId;

    private Instant expiry;

    private String username;

    public UploadSessionDto(String publicId, Instant expiry, String username) {
        this.publicId = publicId;
        this.expiry = expiry;
        this.username = username;
    }

    public String getPublicId() { return this.publicId; }
    public Instant getExpiry() { return this.expiry; }
    public String getUsername() { return this.username; }
}
