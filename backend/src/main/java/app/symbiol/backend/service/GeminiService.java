package app.symbiol.backend.service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import app.symbiol.backend.dto.ChatMessageDto;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
public class GeminiService {

    @Value("${gemini.api-key}")
    private String apiKey;

    private static final String MODEL = "gemini-2.5-flash";
    private static final String BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/";

    /** Matches the body of any LaTeX environment, e.g. \begin{array}{l}...\end{array} */
    private static final Pattern ENV_PATTERN = Pattern.compile(
        "\\\\begin\\{\\w+\\}(?:\\{[^}]*\\})?([\\s\\S]*?)\\\\end\\{\\w+\\}",
        Pattern.DOTALL
    );

    private final HttpClient httpClient = HttpClient.newHttpClient();
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Sends a conversation to Gemini and returns the model's reply text.
     *
     * @param systemPrompt    context prompt (OCR, spatial layout, tutor instructions)
     * @param messages        conversation history, role = "user" or "assistant"
     */
    public String chat(String systemPrompt, List<ChatMessageDto> messages) {
        // Build Gemini contents array — Gemini uses "model" instead of "assistant"
        List<Map<String, Object>> contents = new ArrayList<>();
        for (ChatMessageDto msg : messages) {
            String geminiRole = "assistant".equals(msg.getRole()) ? "model" : "user";
            contents.add(Map.of(
                "role", geminiRole,
                "parts", List.of(Map.of("text", msg.getContent()))
            ));
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("system_instruction", Map.of(
            "parts", List.of(Map.of("text", systemPrompt))
        ));
        body.put("contents", contents);
        body.put("generationConfig", Map.of(
            "temperature", 0.4,
            "maxOutputTokens", 2048
        ));

        String bodyJson;
        try {
            bodyJson = objectMapper.writeValueAsString(body);
        } catch (IOException e) {
            log.error("Failed to serialise Gemini request", e);
            return null;
        }

        String url = BASE_URL + MODEL + ":generateContent?key=" + apiKey;

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(bodyJson))
                .build();

        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                log.error("Gemini returned HTTP {}: {}", response.statusCode(), response.body());
                return null;
            }

            JsonNode root = objectMapper.readTree(response.body());
            return root
                    .path("candidates").get(0)
                    .path("content")
                    .path("parts").get(0)
                    .path("text")
                    .asText(null);

        } catch (IOException | InterruptedException e) {
            log.error("Gemini request failed", e);
            Thread.currentThread().interrupt();
            return null;
        }
    }

    /**
     * Builds the system prompt from OCR text and spatial line_data JSON.
     * The spatial summary is converted to a human-readable list so the model
     * can reference specific positions on the page.
     */
    public String buildSystemPrompt(String ocrText, String lineDataJson) {
        StringBuilder sb = new StringBuilder();

        sb.append("""
                You are a math and science tutor. A student has uploaded a photo of their homework.

                Be direct and concise. Point out errors clearly, explain why they're wrong, and show \
                the correct approach. Don't over-explain or add filler.

                Use LaTeX for math: $inline$ for inline, $$display$$ for display equations.

                When referencing a specific line from the spatial layout, use this markdown link syntax:
                - Single-line entries: [your description](#line-N)
                - A specific step within a multi-step math block (lines that show "— N steps:"): \
                [your description](#line-N-step-M) where M is the 1-indexed step number.
                Example: "[step 3](#line-2-step-3) has a sign error, but [step 5](#line-2-step-5) is correct."
                Only use #line-N-step-M for lines that list multiple steps. Use #line-N for everything else.

                """);

        if (ocrText != null && !ocrText.isBlank()) {
            sb.append("## Extracted content (Mathpix OCR)\n\n");
            sb.append(ocrText.strip());
            sb.append("\n\n");
        }

        if (lineDataJson != null && !lineDataJson.isBlank()) {
            try {
                JsonNode lines = objectMapper.readTree(lineDataJson);
                if (lines.isArray() && !lines.isEmpty()) {
                    sb.append("## Spatial layout (pixel coordinates, top-left origin)\n\n");
                    int i = 1;
                    for (JsonNode line : lines) {
                        String type    = line.path("type").asText("?");
                        String text    = line.path("text").asText("").replace("\n", " ").strip();
                        boolean hw     = line.path("is_handwritten").asBoolean(false);
                        JsonNode cnt   = line.path("cnt");

                        int yTop = Integer.MAX_VALUE, yBot = Integer.MIN_VALUE;
                        if (cnt.isArray()) {
                            for (JsonNode pt : cnt) {
                                if (pt.isArray() && pt.size() >= 2) {
                                    int y = pt.get(1).asInt();
                                    if (y < yTop) yTop = y;
                                    if (y > yBot) yBot = y;
                                }
                            }
                        }

                        String posStr = (yTop != Integer.MAX_VALUE)
                                ? "y=" + yTop + "–" + yBot
                                : "y=?";

                        // For multi-step math blocks, expand into numbered steps
                        if ("math".equals(type)) {
                            List<String> steps = extractMathSteps(line.path("text").asText(""));
                            if (steps.size() > 1) {
                                sb.append(String.format("Line %-2d [%s%s, %s] — %d steps:%n",
                                        i, type, hw ? ", handwritten" : "", posStr, steps.size()));
                                for (int j = 0; j < steps.size(); j++) {
                                    String s = steps.get(j);
                                    sb.append(String.format("  Step %-2d: %s%n",
                                            j + 1,
                                            s.length() > 80 ? s.substring(0, 80) + "…" : s));
                                }
                                i++;
                                continue;
                            }
                        }

                        sb.append(String.format("Line %-2d [%s%s, %s]: %s%n",
                                i++,
                                type,
                                hw ? ", handwritten" : "",
                                posStr,
                                text.length() > 80 ? text.substring(0, 80) + "…" : text));
                    }
                    sb.append("\nLines marked [handwritten] are the student's own working.\n");
                }
            } catch (IOException e) {
                log.warn("Could not parse line_data JSON for system prompt", e);
            }
        }

        return sb.toString();
    }

    /**
     * Splits a Mathpix math text into its individual row steps.
     * Returns a single-element list when the block is not multi-line.
     *
     * LaTeX `\\` line-break appears as two backslash characters in the parsed string.
     */
    private List<String> extractMathSteps(String rawText) {
        if (rawText == null || rawText.isBlank()) return List.of();

        // Extract the inner content of any \begin{...}...\end{...} environment
        Matcher m = ENV_PATTERN.matcher(rawText);
        String content = m.find() ? m.group(1) : rawText;

        // Split on \\ — in the parsed string these are two consecutive backslash chars
        String[] parts = content.split("\\\\\\\\");
        List<String> steps = new ArrayList<>();
        for (String part : parts) {
            String clean = part.strip();
            if (!clean.isEmpty()) steps.add(clean);
        }

        return steps.size() > 1 ? steps : List.of(rawText.strip());
    }
}
