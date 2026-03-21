package app.symbiol.backend.exception;

public class InvalidUploadSessionKeyException extends RuntimeException {

    public InvalidUploadSessionKeyException(String key) {
        super("Invalid upload session key: " + key);
    }
    
}
