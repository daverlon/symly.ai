package app.symbiol.backend.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@Profile("dev")
public class LocalImageStorageService implements ImageStorageService {

    private final Path root = Paths.get("uploads");

    @Override
    public String save(byte[] data, String contentType) {
        String filename = UUID.randomUUID().toString();
        Path file = root.resolve(filename);
        try {
            Files.write(file, data);
        } catch (IOException ex) {
            String s = "Save file exception: " + file.toAbsolutePath() + " " + ex.getMessage();
            log.error(s);
            throw new RuntimeException("Failed to save file: " + file.toAbsolutePath(), ex);
        }
        return filename;
    }

    @Override
    public byte[] load(String key) {
        try {
            return Files.readAllBytes(root.resolve(key));
        } catch (IOException ex) {
            String s = "Save file exception: " + key + " " + ex.getMessage();
            log.error(s);
            throw new RuntimeException("Failed to load file: " + key, ex);
        }
    }


    @Override
    public void delete(String key) {
        try {
            Files.deleteIfExists(root.resolve(key));
        } catch (IOException ex) {
            String s = "Delete file exception: " + key + " " + key;
            log.error(s);
            throw new RuntimeException("Failed to delete file: " + key, ex);
        }
    }
}