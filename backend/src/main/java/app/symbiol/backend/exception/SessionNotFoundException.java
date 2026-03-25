package app.symbiol.backend.exception;

public class SessionNotFoundException extends RuntimeException {
    
    public SessionNotFoundException(String publicId) {
        super("Session not found: " + publicId);
    }
}
