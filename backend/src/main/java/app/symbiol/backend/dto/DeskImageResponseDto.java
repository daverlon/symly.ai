package app.symbiol.backend.dto;

public class DeskImageResponseDto {

    private int position;

    public DeskImageResponseDto(int position) {
        this.position = position;
    }
    
    public int getPosition() { return this.position; }
}
