package app.symbiol.backend.dto;

public class DeskImageResponseDto {

    private int position;
    private String uid;

    public DeskImageResponseDto(int position, String uid) {
        this.position = position;
        this.uid = uid;
    }
    
    public int getPosition() { return this.position; }
    public String getUid() { return this.uid; }
}
