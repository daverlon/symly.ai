package app.symbiol.backend.service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
public class LocalOcrService {

    @Value("${local-ocr.url:}")
    private String localOcrUrl;

    /**
     * Force HTTP/1.1 — uvicorn does not support the HTTP/2 upgrade handshake
     * that Java's default HttpClient attempts.
     */
    private final HttpClient httpClient = HttpClient.newBuilder()
            .version(HttpClient.Version.HTTP_1_1)
            .build();

    private final ObjectMapper objectMapper = new ObjectMapper();

    public boolean isEnabled() {
        return localOcrUrl != null && !localOcrUrl.isBlank();
    }

    public MathpixService.OcrResult extractText(byte[] imageBytes, String contentType) {
        String base64 = Base64.getEncoder().encodeToString(imageBytes);
        String src = "data:" + contentType + ";base64," + base64;

        Map<String, Object> bodyMap = new LinkedHashMap<>();
        bodyMap.put("src", src);

        String body;
        try {
            body = objectMapper.writeValueAsString(bodyMap);
        } catch (IOException e) {
            log.error("Failed to serialise local OCR request", e);
            return new MathpixService.OcrResult(null, null, null);
        }

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(localOcrUrl + "/ocr"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                log.error("Local OCR returned HTTP {}: {}", response.statusCode(), response.body());
                return new MathpixService.OcrResult(null, null, null);
            }
            JsonNode root = objectMapper.readTree(response.body());
            String text        = root.has("text")      ? root.get("text").asText()                              : null;
            String lineDataJson = root.has("line_data") ? objectMapper.writeValueAsString(root.get("line_data")) : null;
            String wordDataJson = root.has("word_data") ? objectMapper.writeValueAsString(root.get("word_data")) : null;
            return new MathpixService.OcrResult(text, lineDataJson, wordDataJson);
        } catch (IOException | InterruptedException e) {
            log.error("Local OCR request failed", e);
            Thread.currentThread().interrupt();
            return new MathpixService.OcrResult(null, null, null);
        }
    }
}
