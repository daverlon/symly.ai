package app.symbiol.backend.dto;

import java.time.Instant;

public class SessionDto {

    private String message;
    private Instant creationDate;

    public SessionDto(String message, Instant creationDate)  {
        this.message = message;
        this.creationDate = creationDate;
    }

    public String getMessage() { return this.message; }

    public Instant getCreationDate() { return this.creationDate; }
}
