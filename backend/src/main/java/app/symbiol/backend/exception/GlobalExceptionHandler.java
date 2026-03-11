package app.symbiol.backend.exception;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(Exception.class)
    public ResponseEntity<String> handleException() {
        return ResponseEntity
            .status(500)
            .body("Internal server error");
    }

    @ExceptionHandler(AccountAlreadyExistsException.class)
    public ResponseEntity<String> handleAccountExists(AccountAlreadyExistsException ex) {
        return ResponseEntity
            .status(409)
            .body(ex.getMessage());
    }

    @ExceptionHandler(UsernameDoesNotExistException.class)
    public ResponseEntity<String> handleUsernameDoesNotExist(UsernameDoesNotExistException ex) {
        return ResponseEntity
            .status(409)
            .body(ex.getMessage());
    }

    @ExceptionHandler(AccountNotFoundException.class)
    public ResponseEntity<String> handleAccountNotFound(AccountNotFoundException ex) {
        return ResponseEntity
            .status(409)
            .body(ex.getMessage());
    }

    @ExceptionHandler(IncorrectPasswordException.class)
    public ResponseEntity<String> handleIncorrectPassword(IncorrectPasswordException ex) {
        return ResponseEntity
            .status(401)
            .body(ex.getMessage());
    }
}
