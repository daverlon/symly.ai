package app.symbiol.backend.dto;

// single image, returned as List<DeskImageDto> when multiple
public class DeskImageDto {
    String name; // filename
    int position;
    String uid;

    public DeskImageDto(String name, int position, String uid) { 
        this.name = name;
        this.position = position;
        this.uid = uid;
    }

    public String getName() { return this.name; }
    public int getPosition() { return this.position; }
    public String getUid() { return this.uid; }
}
