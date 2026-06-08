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
    private static final String OCR_POSTPROCESS_MODEL = "gemini-2.5-flash";
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
        You are a math and science tutor reviewing a student's handwritten homework.

        ## Tone and style
        - Be direct. Name the error, explain why it's wrong, show the fix.
        - No filler phrases like "Great question!" or "Let's explore...".
        - If the work is correct, say so briefly and explain why it works.
        - If the OCR is ambiguous or a step is unclear, say so rather than guessing.

        ## Math formatting
        - Inline math: $...$
        - Display equations: $$...$$
        - Always use LaTeX for any mathematical expression — never plain text.

        ## Referencing the student's work
        When pointing to a specific line or step, embed the student's own LaTeX as a
        markdown link using this syntax:

          Single line:       [<student LaTeX>](#line-N)
          Step within line:  [<student LaTeX>](#line-N-step-M)

        The link text must be the actual LaTeX from the student's work, not a
        description. This is what makes it interactive.

        Examples:
          "You dropped a sign here: [$-3x = 6$](#line-2) should give $x = -2$, not $2$."
          "In this step: [$5x + 11 = 10$](#line-4-step-2), subtract 11 from both sides first."

        Only reference a line if you are specifically commenting on it. Do not list
        every line for completeness.

        ## Concept links
        Wrap the single most important concept mentioned in your response in [[double
        brackets]] — e.g. [[quadratic formula]], [[chain rule]], [[conservation of energy]].
        One per response, only when it's central to the error or explanation. Omit if
        nothing fits naturally.

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
You are processing handwritten math OCR bounding boxes. Group the PP-OCR boxes into logical expression steps.

Input JSON has:
- ppocrLineData: array of { boxId, cnt, text } — one entry per detected text region
- mathpixText: high-quality Mathpix LaTeX for the whole image (use as text authority)

Rules:
1. **Skip non-math and noise.** Omit any box that is: a title, label, header, footer, watermark, or caption (e.g. "Sample Math Question", "for Symly.ai", page numbers); a single stray character or OCR artifact that is not part of an expression; or plain prose with no mathematical content.
2. **Skip unrelated sequences.** If the section contains boxes that clearly belong to a different, unrelated problem or topic, skip those boxes entirely. Only include boxes that form part of the same coherent mathematical working.
3. One group per PP-OCR math line by default — keep each equation step separate.
4. Never merge full derivations into one group.
5. Only merge multiple boxIds when they are clearly one expression split across lines (e.g. fraction numerator/denominator on separate rows, detached superscript).
6. Preserve the top-to-bottom order of the math lines as they appear in ppocrLineData.
7. Use mathpixText to produce correct LaTeX text for each group.

Return a JSON array. Each element must have:
- boxIds: string array of one or more boxId values
- text: LaTeX/text string for that step

Example for a 3-step derivation:
[{"boxIds":["b3"],"text":"5(x+3)-4=10"},{"boxIds":["b4"],"text":"5x+11=10"},{"boxIds":["b5","b6"],"text":"x=\\\\frac{-1}{5}"}]
""";

        // Strip cnt arrays before sending to Gemini — it only needs boxId + text
        String geminiInput = stripCntsForGemini(mergedRawOutputJson);
        String content = prompt + "\n" + geminiInput;
        try {
            // responseSchema: ARRAY of OBJECT {boxIds: ARRAY<STRING>, text: STRING}
            // Note: "required" is not supported by Gemini's structured output and causes HTTP 500.
            ObjectNode stringSchema = objectMapper.createObjectNode();
            stringSchema.put("type", "STRING");

            ObjectNode boxIdsSchema = objectMapper.createObjectNode();
            boxIdsSchema.put("type", "ARRAY");
            boxIdsSchema.set("items", stringSchema);

            ObjectNode stepProps = objectMapper.createObjectNode();
            stepProps.set("boxIds", boxIdsSchema);
            stepProps.set("text", stringSchema.deepCopy());

            ObjectNode stepSchema = objectMapper.createObjectNode();
            stepSchema.put("type", "OBJECT");
            stepSchema.set("properties", stepProps);

            ObjectNode arraySchema = objectMapper.createObjectNode();
            arraySchema.put("type", "ARRAY");
            arraySchema.set("items", stepSchema);

            ObjectNode generationConfig = objectMapper.createObjectNode();
            generationConfig.put("temperature", 0.2);
            generationConfig.put("maxOutputTokens", 16384);
            generationConfig.put("responseMimeType", "application/json");
            generationConfig.set("responseSchema", arraySchema);

            ObjectNode requestBody = objectMapper.createObjectNode();
            requestBody.set("contents", objectMapper.createArrayNode()
                    .add(objectMapper.createObjectNode()
                            .set("parts", objectMapper.createArrayNode()
                                    .add(objectMapper.createObjectNode().put("text", content)))));
            requestBody.set("generationConfig", generationConfig);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(BASE_URL + OCR_POSTPROCESS_MODEL + ":generateContent?key=" + apiKey))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(requestBody)))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                log.error("Gemini expression request failed: HTTP {} — {}", response.statusCode(), response.body());
                return null;
            }

            JsonNode root = objectMapper.readTree(response.body());
            String out = root.path("candidates").path(0).path("content").path("parts").path(0).path("text").asText(null);
            log.info("Gemini expression raw output: {}", out);
            if (out == null || out.isBlank()) {
                log.error("Gemini returned empty expression output; full response: {}", response.body());
                return null;
            }
            String cleaned = out.replaceAll("```json\\s*", "").replaceAll("```\\s*$", "").trim();
            String result = toValidJsonArray(cleaned);
            log.info("Gemini expression parsed: {} chars", result != null ? result.length() : 0);
            return result;
        } catch (IOException | InterruptedException e) {
            log.error("Gemini expression request failed", e);
            Thread.currentThread().interrupt();
            return null;
        }
    }

    /**
     * Removes pixel-coordinate "cnt" arrays from merged raw output before sending to Gemini.
     * Gemini only needs boxId + text to do the grouping; sending large coordinate arrays
     * wastes tokens and can push the payload over model limits.
     */
    private String stripCntsForGemini(String mergedRawOutputJson) {
        if (mergedRawOutputJson == null) return "{}";
        try {
            JsonNode root = objectMapper.readTree(mergedRawOutputJson);
            if (root.isObject()) {
                ObjectNode out = objectMapper.createObjectNode();
                root.fields().forEachRemaining(entry -> {
                    if (entry.getValue().isArray()) {
                        com.fasterxml.jackson.databind.node.ArrayNode stripped =
                                objectMapper.createArrayNode();
                        for (JsonNode item : entry.getValue()) {
                            if (item.isObject()) {
                                ObjectNode slim = item.deepCopy();
                                slim.remove("cnt");
                                stripped.add(slim);
                            } else {
                                stripped.add(item);
                            }
                        }
                        out.set(entry.getKey(), stripped);
                    } else {
                        out.set(entry.getKey(), entry.getValue());
                    }
                });
                return objectMapper.writeValueAsString(out);
            }
        } catch (IOException e) {
            log.warn("Could not strip cnts from merged output, sending as-is", e);
        }
        return mergedRawOutputJson;
    }

    /**
     * Parses the Gemini output and always returns a JSON array string, or null on failure.
     * Handles: bare array, object wrapping an array, or prose with embedded array.
     */
    private String toValidJsonArray(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            JsonNode parsed = objectMapper.readTree(raw);
            if (parsed.isArray()) {
                return objectMapper.writeValueAsString(parsed);
            }
            // Object returned — look for any array field
            if (parsed.isObject()) {
                for (JsonNode field : parsed) {
                    if (field.isArray()) {
                        log.warn("Gemini wrapped array in object; extracting first array field");
                        return objectMapper.writeValueAsString(field);
                    }
                }
            }
            log.error("Gemini returned valid JSON but not an array: {}", raw);
            return null;
        } catch (IOException ignored) {
            // Not valid JSON — first try to extract a complete [...] from surrounding prose
            int firstBracket = raw.indexOf('[');
            int lastBracket = raw.lastIndexOf(']');
            if (firstBracket >= 0 && lastBracket > firstBracket) {
                String sliced = raw.substring(firstBracket, lastBracket + 1);
                try {
                    JsonNode parsed = objectMapper.readTree(sliced);
                    if (parsed.isArray()) {
                        return objectMapper.writeValueAsString(parsed);
                    }
                } catch (IOException ignoredAgain) {
                    // fall through to truncation recovery
                }
            }

            // Truncation recovery — output was cut off mid-JSON; salvage complete items.
            // Walk backwards from the end of the array content looking for the last "},"
            // that closes a complete array element, then close the array there.
            if (firstBracket >= 0) {
                String partial = raw.substring(firstBracket);
                // Try progressively shorter slices ending at "}," boundaries
                int searchFrom = partial.length();
                while (searchFrom > 1) {
                    int lastCommaClose = partial.lastIndexOf("},", searchFrom - 1);
                    if (lastCommaClose < 0) break;
                    String candidate = partial.substring(0, lastCommaClose + 1) + "]";
                    try {
                        JsonNode parsed = objectMapper.readTree(candidate);
                        if (parsed.isArray() && !parsed.isEmpty()) {
                            log.warn("Gemini output truncated; recovered {} complete item(s) from partial response",
                                    parsed.size());
                            return objectMapper.writeValueAsString(parsed);
                        }
                    } catch (IOException ignoredRecovery) {
                        // keep shrinking
                    }
                    searchFrom = lastCommaClose;
                }
            }

            log.error("Gemini returned non-parseable expression output: {}", raw);
            return null;
        }
    }
}
