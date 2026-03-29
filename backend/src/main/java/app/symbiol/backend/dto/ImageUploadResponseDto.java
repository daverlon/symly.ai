package app.symbiol.backend.dto;

public class ImageUploadResponseDto {
    private String responseText;

    public ImageUploadResponseDto(String responseText) {
        this.responseText = responseText;
    }

    public String getResponseText() { return this.responseText; }
    
}
