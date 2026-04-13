package app.symbiol.backend.dto;

// single image, returned as List<DeskImageDto> when multiple
public class DeskImageDto {
    String name; // filename
    int position;

    public DeskImageDto(String name, int position) { 
        this.name = name;
        this.position = position;
    }

    public String getName() { return this.name; }
    public int getPosition() { return this.position; }
}
