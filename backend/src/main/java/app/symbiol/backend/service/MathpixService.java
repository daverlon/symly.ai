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
public class MathpixService {

    @Value("${mathpix.app-id}")
    private String appId;

    @Value("${mathpix.app-key}")
    private String appKey;

    private static final String MATHPIX_URL = "https://api.mathpix.com/v3/text";
    private final HttpClient httpClient = HttpClient.newHttpClient();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public record OcrResult(String text, String lineDataJson, String wordDataJson) {}

    public OcrResult extractText(byte[] imageBytes, String contentType) {
        String base64 = Base64.getEncoder().encodeToString(imageBytes);
        String src = "data:" + contentType + ";base64," + base64;

        Map<String, Object> bodyMap = new LinkedHashMap<>();
        bodyMap.put("src", src);
        bodyMap.put("formats", new String[]{"text"});
        bodyMap.put("rm_spaces", true);
        bodyMap.put("math_inline_delimiters", new String[]{"$", "$"});
        bodyMap.put("math_display_delimiters", new String[]{"$$", "$$"});
        bodyMap.put("include_line_data", true);
        bodyMap.put("include_word_data", true);
        bodyMap.put("idiomatic_eqn_arrays", true);

        String body;
        try {
            body = objectMapper.writeValueAsString(bodyMap);
        } catch (IOException e) {
            log.error("Failed to serialise Mathpix request", e);
            return new OcrResult(null, null, null);
        }

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(MATHPIX_URL))
                .header("app_id", appId)
                .header("app_key", appKey)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                log.error("Mathpix returned HTTP {}: {}", response.statusCode(), response.body());
                return new OcrResult(null, null, null);
            }

            JsonNode root = objectMapper.readTree(response.body());

            if (root.has("error")) {
                log.error("Mathpix error: {}", root.get("error").asText());
                return new OcrResult(null, null, null);
            }

            String text         = root.has("text")      ? root.get("text").asText()                              : null;
            String lineDataJson = root.has("line_data")  ? objectMapper.writeValueAsString(root.get("line_data")) : null;
            String wordDataJson = root.has("word_data")  ? objectMapper.writeValueAsString(root.get("word_data")) : null;

            return new OcrResult(text, lineDataJson, wordDataJson);
        } catch (IOException | InterruptedException e) {
            log.error("Mathpix request failed", e);
            Thread.currentThread().interrupt();
            return new OcrResult(null, null, null);
        }
    }
}
