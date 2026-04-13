package app.symbiol.backend.dto;

import java.time.Instant;
import java.util.List;

// all session data

public class SessionDto {

    private Instant creationDate;
    private List<DeskImageDto> deskImages;

    public SessionDto(Instant creationDate, List<DeskImageDto> deskImages)  {
        this.creationDate = creationDate;
        this.deskImages = deskImages;
    }

    public Instant getCreationDate() { return this.creationDate; }
    public List<DeskImageDto> getDeskImages() { return this.deskImages; }
}
