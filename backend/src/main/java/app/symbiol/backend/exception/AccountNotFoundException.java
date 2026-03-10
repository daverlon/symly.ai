package app.symbiol.backend.exception;

public class AccountNotFoundException extends RuntimeException {
    
    public AccountNotFoundException(String username) {
        super("Account not found: " + username);
    }
}
