package app.symbiol.backend.dto;

// single image, returned as List<DeskImageDto> when multiple
public class DeskImageDto {
    String url;
    int position;

    public DeskImageDto(String url, int position) { 
        this.url = url;
        this.position = position;
    }

    public String getUrl() { return this.url; }
    public int getPosition() { return this.position; }
}
