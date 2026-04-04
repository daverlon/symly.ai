package app.symbiol.backend.dto;

import java.time.Instant;

public class SessionImageDto {
    
    private String name;
    private Instant uploadDate;
    private String url;


    public SessionImageDto() {}

    public void setName(String name) { this.name = name; }
    public void setUploadDate(Instant uploadDate) { this.uploadDate = uploadDate; }
    public void setUrl(String url) { this.url = url; }

    public String getName() { return this.name; }
    public Instant getUploadDtae() { return this.uploadDate; }
    public String getUrl() { return this.url; }
}
