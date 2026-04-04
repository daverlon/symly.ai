package app.symbiol.backend.dto;

import java.time.Instant;

public class SessionImageDto {
    

    private String name;
    private byte[] image;
    private Instant uploadDate;


    public SessionImageDto() {}

    public void setName(String name) { this.name = name; }

    // set image data
    public void setImage(byte[] image) { this.image = image; }

    public void setUploadDate(Instant uploadDate) { this.uploadDate = uploadDate; }

    public String getName() { return this.name; }
    public byte[] getImage() { return this.image; }
    public Instant getUploadDtae() { return this.uploadDate; }
}
