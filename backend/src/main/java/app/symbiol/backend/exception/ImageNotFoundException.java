package app.symbiol.backend.exception;

public class ImageNotFoundException extends RuntimeException {
    public ImageNotFoundException(String name) {
        super("Image not found: " + name);
    }
}
