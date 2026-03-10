package app.symbiol.backend.exception;

public class AccountAlreadyExistsException extends RuntimeException {

    public AccountAlreadyExistsException(String username) {
        super("Account already exists: " + username);
    }
}
