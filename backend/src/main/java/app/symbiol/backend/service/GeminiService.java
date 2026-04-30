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
import com.fasterxml.jackson.databind.node.ObjectNode;

import app.symbiol.backend.dto.ChatMessageDto;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
public class GeminiService {

    @Value("${gemini.api-key}")
    private String apiKey;

    private static final String CHAT_MODEL = "gemini-2.5-flash";
    private static final String OCR_POSTPROCESS_MODEL = "gemini-2.5-flash-lite";
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

        String url = BASE_URL + CHAT_MODEL + ":generateContent?key=" + apiKey;

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
## Role
You are an authentic, direct Math and Science Tutor. You are reviewing a student's work provided as an ordered JSON array of mathematical expressions and text.

## Tone & Style
- **Be Direct:** No fluff. Don't say "I've analyzed your work" or "Let's look at this." Start immediately with the feedback.
- **Peer-to-Peer:** Speak like a helpful, grounded peer. Validate correct logic briefly and correct errors firmly but gently.
- **Detective Work:** Distinguish the original "Question" from the student's "Attempt" based on context (e.g., lines starting with '=' are usually attempts).

## Feedback Logic
1. **Identify the Goal:** Determine the problem the student is trying to solve.
2. **Scan for Errors:** Check each step for algebraic, sign, or calculation mistakes.
3. **Correct:** If a mistake is found, name the error, explain the correct logic, and provide the fix.
4. **Validate:** If the work is 100% correct, say "The logic is correct" and explain why the steps hold up.

## Interaction & Linking (CRITICAL)
You must reference specific steps using Markdown links so the UI can highlight them.
- **Anchor Mapping:** The first object in the input array is "Line 1", the second is "Line 2", and so on.
- **Link Syntax:** `[Exact LaTeX from input](#line-N)`
- **Example:** "You made a calculation error in [$=5 x+15-4=10$](#line-4). It should simplify to $+11$."

## Formatting
- **LaTeX:** Use $...$ for inline math and $$...$$ for standalone equations. Use LaTeX for all variables and numbers.
- **Concept Tags:** Wrap the core mathematical concept in [[double brackets]] (e.g., [[distributive property]]). Max one per response.

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

    public String buildExpressionRawOutput(String mergedRawOutputJson) {
        String prompt = """
Please process the provided JSON array of bounding boxes for handwritten math OCR. Group these boxes into logical mathematical units based on these rules:

1.  **Do not merge distinct steps:** Each step of an equation should remain separate. Only merge boxes if they are parts of the *same* line or step (e.g., a numerator box and a denominator box forming a single fraction).
2.  **Spatial Logic:** Boxes that are vertically stacked or horizontally overlapping and represent fragments of the same equation line should be merged into a single `text` string.
3.  **LaTeX Integration:** Intelligently combine the `text` fields. If a box contains a partial fraction structure (like a numerator or denominator split across boxes), merge them into valid LaTeX syntax (e.g., `\\frac{numerator}{denominator}`).
4.  **Output Format:** Return a JSON array where each object contains:
    *   `boxIds`: Array of box IDs that form this specific logical unit.
    *   `text `: The resulting combined LaTeX string for that unit.

""";

        String content = prompt + "\n" + (mergedRawOutputJson != null ? mergedRawOutputJson : "[]");
        try {
            com.fasterxml.jackson.databind.node.ObjectNode requestBody = objectMapper.createObjectNode();
            requestBody.set("contents", objectMapper.createArrayNode()
                    .add(objectMapper.createObjectNode()
                            .set("parts", objectMapper.createArrayNode()
                                    .add(objectMapper.createObjectNode()
                                            .put("text", content)))));
            requestBody.set("generationConfig", objectMapper.createObjectNode()
                    .put("temperature", 0.2)
                    .put("maxOutputTokens", 4096)
                    .put("responseMimeType", "application/json"));

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(BASE_URL + OCR_POSTPROCESS_MODEL + ":generateContent?key=" + apiKey))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(requestBody)))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                log.error("Gemini expression request failed: HTTP {}", response.statusCode());
                return null;
            }

            JsonNode root = objectMapper.readTree(response.body());
            String out = root.path("candidates")
                    .path(0)
                    .path("content")
                    .path("parts")
                    .path(0)
                    .path("text")
                    .asText(null);

            if (out == null) return null;
            String cleaned = out.replaceAll("```json\\s*", "").replaceAll("```\\s*$", "").trim();
            return toValidJsonOrError(cleaned);
        } catch (IOException | InterruptedException e) {
            log.error("Gemini expression request failed", e);
            Thread.currentThread().interrupt();
            return null;
        }
    }

    private String toValidJsonOrError(String raw) {
        if (raw == null || raw.isBlank()) {
            return "{\"error\":\"empty_output\"}";
        }
        try {
            JsonNode parsed = objectMapper.readTree(raw);
            return objectMapper.writeValueAsString(parsed);
        } catch (IOException ignored) {
            // Try to salvage when model adds extra prose around JSON.
            int firstBracket = raw.indexOf('[');
            int lastBracket = raw.lastIndexOf(']');
            if (firstBracket >= 0 && lastBracket > firstBracket) {
                String sliced = raw.substring(firstBracket, lastBracket + 1);
                try {
                    JsonNode parsed = objectMapper.readTree(sliced);
                    return objectMapper.writeValueAsString(parsed);
                } catch (IOException ignoredAgain) {
                    // fall through
                }
            }
            ObjectNode err = objectMapper.createObjectNode();
            err.put("error", "invalid_json_from_model");
            err.put("raw", raw);
            try {
                return objectMapper.writeValueAsString(err);
            } catch (IOException e) {
                return "{\"error\":\"invalid_json_from_model\"}";
            }
        }
    }
}
