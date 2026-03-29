package app.symbiol.backend.exception;

public class InvalidUploadImageTypeException extends RuntimeException {
    public InvalidUploadImageTypeException(String message) {
        super(message);
    }
}
