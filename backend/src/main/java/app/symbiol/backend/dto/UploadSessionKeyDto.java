package app.symbiol.backend.dto;

public class UploadSessionKeyDto {

    private String key;

    private String uploadUrl;

    public UploadSessionKeyDto(String key, String uploadUrl) {
        this.key = key;
        this.uploadUrl = uploadUrl;
    }

    public String getKey() {
        return key;
    }

    public String getUploadUrl() {
        return uploadUrl;
    }

    public void setUploadUrl(String uploadUrl) {
        this.uploadUrl = uploadUrl;
    }
}
