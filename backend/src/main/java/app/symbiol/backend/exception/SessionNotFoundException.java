package app.symbiol.backend.exception;

public class SessionNotFoundException extends RuntimeException {
    
    public SessionNotFoundException(Long sessionId) {
        super("Session not found: " + sessionId);
    }
}
