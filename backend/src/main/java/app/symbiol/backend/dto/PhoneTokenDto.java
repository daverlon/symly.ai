package app.symbiol.backend.dto;

public class PhoneTokenDto {

    private String token;
    private String uploadUrl;

    public PhoneTokenDto(String token, String uploadUrl) {
        this.token = token;
        this.uploadUrl = uploadUrl;
    }

    public String getToken() {
        return token;
    }

    public String getUploadUrl() {
        return uploadUrl;
    }
}

