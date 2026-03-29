package app.symbiol.backend.service;

public interface ImageStorageService {
    String save(byte[] data, String contentType);
    byte[] load(String key);
    void delete(String key);
}
