package app.symbiol.backend.exception;


public class UsernameDoesNotExistException extends RuntimeException {
    
    public UsernameDoesNotExistException(String username) {
        super("Username does not exist: " + username);
    }
}
