package app.symbiol.backend.service;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import app.symbiol.backend.dto.DeskImageDto;
import app.symbiol.backend.dto.DeskImageResponseDto;
import app.symbiol.backend.exception.ImageNotFoundException;
import app.symbiol.backend.exception.SessionNotFoundException;
import app.symbiol.backend.model.DeskImage;
import app.symbiol.backend.model.Image;
import app.symbiol.backend.model.Session;
import app.symbiol.backend.repository.DeskImageRepository;
import app.symbiol.backend.repository.ImageRepository;
import app.symbiol.backend.repository.SessionRepository;
import jakarta.transaction.Transactional;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
public class DeskService {

    private final DeskImageRepository deskImageRepository;
    private final SessionRepository sessionRepository;
    private final ImageRepository imageRepository;
    private final ImageStorageService imageStorageService;
    private final MathpixService mathpixService;
    private final LocalOcrService localOcrService;
    private final GeminiService geminiService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public DeskService(
        DeskImageRepository deskImageRepository,
        SessionRepository sessionRepository,
        ImageRepository imageRepository,
        ImageStorageService imageStorageService,
        MathpixService mathpixService,
        LocalOcrService localOcrService,
        GeminiService geminiService
   ) {
        this.deskImageRepository = deskImageRepository;
        this.sessionRepository = sessionRepository;
        this.imageRepository = imageRepository;
        this.imageStorageService = imageStorageService;
        this.mathpixService = mathpixService;
        this.localOcrService = localOcrService;
        this.geminiService = geminiService;
    }

    public List<DeskImage> getDeskImages(String publicSessionId) {
        Session s = sessionRepository.findByPublicId(publicSessionId)
            .orElseThrow(() -> new SessionNotFoundException(publicSessionId));

        List<DeskImage> deskImages = deskImageRepository.findAllBySessionId(s.getId());
        return deskImages;
    }

    @Transactional
    public DeskImageResponseDto createDeskImage(String publicSessionId, DeskImageDto data) {

        Session s = sessionRepository.findByPublicId(publicSessionId)
            .orElseThrow(() -> new SessionNotFoundException(publicSessionId));

        Image i = imageRepository.findByFileName(data.getName())
            .orElseThrow(() -> new ImageNotFoundException(publicSessionId));


        DeskImage image = new DeskImage(s, i, -1);

        deskImageRepository.findTopBySessionIdOrderByPositionDesc(s.getId())
            .ifPresentOrElse(
                img -> {
                    int position = img.getPosition();
                    image.setPosition(position + 1000);
                },
                () -> {
                    image.setPosition(1000);
                }
            );
        deskImageRepository.save(image);
        return new DeskImageResponseDto(image.getPosition(), image.getUid());
    }

    private static final int REBALANCE_GAP = 1000;
    private static final int MIN_GAP = 2;

    @Transactional
    public void moveDeskImage(String publicSessionId, String uid, String afterUid, String username) {
        Session s = sessionRepository.findByPublicIdAndAccount_Username(publicSessionId, username)
                .orElseThrow(() -> new SessionNotFoundException(publicSessionId));

        List<DeskImage> allImages = deskImageRepository.findAllBySessionIdOrderByPositionAsc(s.getId());

        DeskImage itemToMove = allImages.stream()
                .filter(img -> img.getUid().equals(uid))
                .findFirst()
                .orElseThrow(() -> new ImageNotFoundException(uid));

        List<DeskImage> otherImages = allImages.stream()
                .filter(img -> !img.getUid().equals(uid))
                .collect(Collectors.toList());

        int newPosition = computeInsertPosition(otherImages, afterUid);

        itemToMove.setPosition(newPosition);
        deskImageRepository.save(itemToMove);
    }

    private int computeInsertPosition(List<DeskImage> others, String afterUid) {
        if (afterUid == null) {
            if (others.isEmpty()) return REBALANCE_GAP;
            int firstPos = others.get(0).getPosition();
            if (firstPos >= MIN_GAP) return firstPos / 2;
            rebalance(others);
            return others.get(0).getPosition() / 2;
        }

        int afterIndex = -1;
        for (int i = 0; i < others.size(); i++) {
            if (others.get(i).getUid().equals(afterUid)) {
                afterIndex = i;
                break;
            }
        }
        if (afterIndex == -1) throw new ImageNotFoundException(afterUid);

        DeskImage afterItem = others.get(afterIndex);

        if (afterIndex == others.size() - 1) {
            return afterItem.getPosition() + REBALANCE_GAP;
        }

        DeskImage nextItem = others.get(afterIndex + 1);
        int gap = nextItem.getPosition() - afterItem.getPosition();

        if (gap >= MIN_GAP) {
            return afterItem.getPosition() + gap / 2;
        }

        rebalance(others);
        DeskImage rebalancedAfter = others.get(afterIndex);
        DeskImage rebalancedNext = others.get(afterIndex + 1);
        return rebalancedAfter.getPosition() +
                (rebalancedNext.getPosition() - rebalancedAfter.getPosition()) / 2;
    }

    private void rebalance(List<DeskImage> images) {
        for (int i = 0; i < images.size(); i++) {
            images.get(i).setPosition((i + 1) * REBALANCE_GAP);
        }
        deskImageRepository.saveAll(images);
    }

    @Transactional
    public void deleteDeskImage(String publicSessionId, String uid, String username) {
        Session s = sessionRepository.findByPublicIdAndAccount_Username(publicSessionId, username)
                .orElseThrow(() -> new SessionNotFoundException(publicSessionId));

        DeskImage deskImage = deskImageRepository.findByUidAndSessionId(uid, s.getId())
                .orElseThrow(() -> new ImageNotFoundException(uid));

        deskImageRepository.delete(deskImage);
    }

    @Transactional
    public void deleteAllDeskImages(String publicSessionId) {
        Session s = sessionRepository.findByPublicId(publicSessionId)
                .orElseThrow(() -> new SessionNotFoundException(publicSessionId));

        List<DeskImage> i = deskImageRepository.findAllBySessionId(s.getId());
        i.forEach((img) -> {
            if (img != null)
                deskImageRepository.delete(img);
        });
    }

    public record OcrResult(
        String text,
        String lineDataJson,
        String wordDataJson,
        String mathpixText,
        String ppocrText,
        String mathpixLineDataJson,
        String mathpixWordDataJson,
        String mergedRawOutput,
        String expressionRawOutput
    ) {}

    /** Returns the Mathpix OCR result for the given desk image, caching on the Image row. */
    @Transactional
    public OcrResult getOcrResult(String publicSessionId, String uid, String username) {
        Session s = sessionRepository.findByPublicIdAndAccount_Username(publicSessionId, username)
                .orElseThrow(() -> new SessionNotFoundException(publicSessionId));

        DeskImage deskImage = deskImageRepository.findByUidAndSessionId(uid, s.getId())
                .orElseThrow(() -> new ImageNotFoundException(uid));

        Image image = deskImage.getImage();

        if (image.getOcrText() != null) {
            return cachedOcrResult(image);
        }

        byte[] imageBytes = imageStorageService.load(image.getFileName());
        String contentType = detectContentType(image.getFileName());

        // Local pipeline: keep PP-OCRv5 raw payload and Mathpix raw payload separate.
        // No bbox merge/enrichment for now.
        if (localOcrService.isEnabled()) {
            log.info("=== PP-OCRv5 + MATHPIX RAW PIPELINE START ===");

            MathpixService.OcrResult local = localOcrService.extractText(imageBytes, contentType);
            MathpixService.OcrResult mathpix = mathpixService.extractText(imageBytes, contentType);

            // Prepare PP-OCR data once: assign stable box IDs then simplify to {boxId, cnt, text}
            JsonNode ppocrSimplified = simplifyPpocrLineData(
                    withSequentialBoxIds(parseJsonOrNull(local.lineDataJson())));
            String mathpixText = mathpix.text() != null ? mathpix.text() : "";

            // Full merged view (all boxes) stored for debug UI
            String mergedRawOutput = buildMergedRawOutputFromNodes(ppocrSimplified, mathpixText);

            // Expression grouping — uses Mathpix line_data to split when box count is high
            String expressionRawOutput = buildExpressionRawOutputWithSplitting(
                    ppocrSimplified, mathpixText, imageBytes, contentType);

            String ppocrText = local.text() != null ? local.text() : "";
            String finalText = !mathpixText.isBlank() ? mathpixText : ppocrText;

            persistOcrCache(image, finalText, local.lineDataJson(), local.wordDataJson(),
                    ppocrText, mathpixText, mergedRawOutput, expressionRawOutput);
            imageRepository.save(image);
            return cachedOcrResult(image);
        }

        // Fallback to Mathpix text only (no local PP-OCR)
        MathpixService.OcrResult raw = mathpixService.extractText(imageBytes, contentType);
        String mathpixText = raw.text() != null ? raw.text() : "";
        persistOcrCache(image, mathpixText, null, null, null, mathpixText, null, null);
        imageRepository.save(image);

        return cachedOcrResult(image);
    }

    private OcrResult cachedOcrResult(Image image) {
        return new OcrResult(
            image.getOcrText(),
            image.getOcrLineData(),
            image.getOcrWordData(),
            image.getOcrMathpixText(),
            image.getOcrPpocrText(),
            null,
            null,
            image.getOcrMergedRawOutput(),
            image.getOcrExpressionRawOutput()
        );
    }

    private void persistOcrCache(
            Image image,
            String finalText,
            String lineDataJson,
            String wordDataJson,
            String ppocrText,
            String mathpixText,
            String mergedRawOutput,
            String expressionRawOutput) {
        image.setOcrText(finalText);
        image.setOcrLineData(lineDataJson);
        image.setOcrWordData(wordDataJson);
        image.setOcrPpocrText(ppocrText);
        image.setOcrMathpixText(mathpixText);
        image.setOcrMergedRawOutput(mergedRawOutput);
        image.setOcrExpressionRawOutput(expressionRawOutput);
    }

    /** Clears cached Mathpix OCR so the next getOcrResult call re-runs against the API. */
    @Transactional
    public void clearOcrCache(String publicSessionId, String uid, String username) {
        Session s = sessionRepository.findByPublicIdAndAccount_Username(publicSessionId, username)
                .orElseThrow(() -> new SessionNotFoundException(publicSessionId));

        DeskImage deskImage = deskImageRepository.findByUidAndSessionId(uid, s.getId())
                .orElseThrow(() -> new ImageNotFoundException(uid));

        Image image = deskImage.getImage();
        image.setOcrText(null);
        image.setOcrLineData(null);
        image.setOcrWordData(null);
        image.setOcrPpocrText(null);
        image.setOcrMathpixText(null);
        image.setOcrMergedRawOutput(null);
        image.setOcrExpressionRawOutput(null);
        imageRepository.save(image);
    }

    private static String detectContentType(String fileName) {
        String lower = fileName.toLowerCase();
        if (lower.endsWith(".png")) return "image/png";
        return "image/jpeg";
    }

    private String buildMergedRawOutputFromNodes(JsonNode ppocrLineData, String mathpixText) {
        try {
            ObjectNode payload = objectMapper.createObjectNode();
            payload.set("ppocrLineData", ppocrLineData);
            payload.put("mathpixText", mathpixText != null ? mathpixText : "");
            return objectMapper.writeValueAsString(payload);
        } catch (IOException e) {
            log.error("Failed to build merged raw output", e);
            return "{}";
        }
    }

    // ---------------------------------------------------------------------------
    // Per-step Gemini expression grouping (Mathpix step bbox → intersecting PP-OCR boxes)
    // ---------------------------------------------------------------------------

    /**
     * When a single Mathpix step has more than this many intersecting PP-OCR boxes,
     * it is split further by vertical gap before being sent to Gemini.
     * This handles cases where Mathpix groups an entire multi-equation derivation into
     * one line_data entry (e.g. a system of equations + all its matrix representations).
     */
    private static final int STEP_MAX_BOXES = 20;

    /**
     * For each Mathpix line_data entry (one semantic step/block), finds the PP-OCR boxes
     * that spatially intersect that entry's bounding box and calls Gemini with only those
     * boxes + that step's Mathpix text. This keeps each Gemini call small and focused.
     * When a single Mathpix entry has too many boxes, y-gap splitting is applied within it.
     * Falls back to a single full-page call if Mathpix line_data is unavailable.
     */
    private String buildExpressionRawOutputWithSplitting(
            JsonNode ppocrSimplified, String mathpixText, byte[] imageBytes, String contentType) {

        String mathpixLineDataJson = mathpixService.extractLineDataJson(imageBytes, contentType);
        if (mathpixLineDataJson == null) {
            log.warn("Mathpix line_data unavailable; falling back to single Gemini call for {} boxes",
                    ppocrSimplified.isArray() ? ppocrSimplified.size() : 0);
            return geminiService.buildExpressionRawOutput(
                    buildMergedRawOutputFromNodes(ppocrSimplified, mathpixText));
        }

        try {
            JsonNode mathpixSteps = objectMapper.readTree(mathpixLineDataJson);
            if (!mathpixSteps.isArray() || mathpixSteps.isEmpty()) {
                log.warn("Mathpix returned empty line_data; falling back to single Gemini call");
                return geminiService.buildExpressionRawOutput(
                        buildMergedRawOutputFromNodes(ppocrSimplified, mathpixText));
            }

            log.info("Per-step Gemini grouping: {} Mathpix steps, {} PP-OCR boxes",
                    mathpixSteps.size(), ppocrSimplified.isArray() ? ppocrSimplified.size() : 0);

            com.fasterxml.jackson.databind.node.ArrayNode allResults = objectMapper.createArrayNode();
            int stepIdx = 0;

            for (JsonNode mathpixStep : mathpixSteps) {
                stepIdx++;
                String stepText = mathpixStep.path("text").asText("").strip();
                if (stepText.isBlank()) continue;

                // Find the PP-OCR boxes whose AABB intersects this Mathpix step's bbox
                int[] stepAabb = computeAabb(mathpixStep.path("cnt"));
                List<JsonNode> intersecting = findIntersectingBoxes(ppocrSimplified, stepAabb);

                if (intersecting.isEmpty()) {
                    log.debug("Mathpix step {}/{} has no intersecting PP-OCR boxes; skipping",
                            stepIdx, mathpixSteps.size());
                    continue;
                }

                // When this Mathpix entry spans too many boxes (Mathpix grouped a large derivation
                // into a single block), split it by vertical gap before calling Gemini
                List<List<JsonNode>> subGroups = intersecting.size() > STEP_MAX_BOXES
                        ? splitByYGap(intersecting)
                        : List.of(intersecting);

                log.info("Mathpix step {}/{}: {} PP-OCR boxes → {} Gemini call(s)",
                        stepIdx, mathpixSteps.size(), intersecting.size(), subGroups.size());

                int subIdx = 0;
                for (List<JsonNode> subBoxes : subGroups) {
                    subIdx++;
                    if (subBoxes.isEmpty()) continue;

                    com.fasterxml.jackson.databind.node.ArrayNode stepArray = objectMapper.createArrayNode();
                    subBoxes.forEach(stepArray::add);

                    // Each Gemini call gets the sub-group's PP-OCR boxes + the full step's Mathpix text
                    String stepMerged = buildMergedRawOutputFromNodes(stepArray, stepText);
                    String stepResult = geminiService.buildExpressionRawOutput(stepMerged);

                    if (stepResult != null) {
                        try {
                            JsonNode parsed = objectMapper.readTree(stepResult);
                            if (parsed.isArray()) {
                                for (JsonNode item : parsed) allResults.add(item);
                            }
                        } catch (IOException e) {
                            log.warn("Could not parse Gemini result for step {}/{} sub {}", stepIdx, mathpixSteps.size(), subIdx, e);
                        }
                    }
                }
            }

            log.info("Per-step Gemini complete: {} total expression steps from {} Mathpix entries",
                    allResults.size(), stepIdx);
            return objectMapper.writeValueAsString(allResults);

        } catch (IOException e) {
            log.error("Failed during per-step Gemini processing; falling back to single call", e);
            return geminiService.buildExpressionRawOutput(
                    buildMergedRawOutputFromNodes(ppocrSimplified, mathpixText));
        }
    }

    /**
     * Returns all PP-OCR boxes whose AABB intersects the given target AABB,
     * sorted top-to-bottom by centroid Y.
     */
    private List<JsonNode> findIntersectingBoxes(JsonNode ppocrBoxes, int[] targetAabb) {
        List<JsonNode> result = new ArrayList<>();
        for (JsonNode box : ppocrBoxes) {
            if (overlapArea(computeAabb(box.path("cnt")), targetAabb) > 0) {
                result.add(box);
            }
        }
        result.sort(Comparator.comparingInt(box -> {
            int[] aabb = computeAabb(box.path("cnt"));
            return (aabb[1] + aabb[3]) / 2;
        }));
        return result;
    }

    /**
     * Splits a list of PP-OCR boxes into sub-groups using vertical gap detection.
     * Threshold = median consecutive centroid-Y gap × 2.5, minimum 20 px.
     * Applied as a fallback when a single Mathpix step has too many intersecting boxes.
     */
    private List<List<JsonNode>> splitByYGap(List<JsonNode> boxes) {
        // Boxes are already sorted by centroid Y from findIntersectingBoxes
        int n = boxes.size();
        if (n <= 1) return List.of(boxes);

        int[] ys = new int[n];
        for (int i = 0; i < n; i++) {
            int[] aabb = computeAabb(boxes.get(i).path("cnt"));
            ys[i] = (aabb[1] + aabb[3]) / 2;
        }

        int[] gaps = new int[n - 1];
        for (int i = 0; i < gaps.length; i++) gaps[i] = ys[i + 1] - ys[i];

        int[] sortedGaps = gaps.clone();
        Arrays.sort(sortedGaps);
        double medianGap = sortedGaps[sortedGaps.length / 2];
        double threshold = Math.max(medianGap * 2.5, 20.0);

        List<List<JsonNode>> result = new ArrayList<>();
        List<JsonNode> current = new ArrayList<>();
        current.add(boxes.get(0));

        for (int i = 1; i < n; i++) {
            if (gaps[i - 1] > threshold) {
                result.add(current);
                current = new ArrayList<>();
            }
            current.add(boxes.get(i));
        }
        result.add(current);

        log.info("y-gap split: {} boxes → {} sub-groups (median gap {}px, threshold {:.0f}px)",
                n, result.size(), (int) medianGap, threshold);
        return result;
    }

    /** Computes the axis-aligned bounding box of a cnt polygon as [minX, minY, maxX, maxY]. */
    private int[] computeAabb(JsonNode cntArray) {
        int minX = Integer.MAX_VALUE, minY = Integer.MAX_VALUE;
        int maxX = Integer.MIN_VALUE, maxY = Integer.MIN_VALUE;
        if (cntArray != null && cntArray.isArray()) {
            for (JsonNode pt : cntArray) {
                if (pt.isArray() && pt.size() >= 2) {
                    int x = pt.get(0).asInt();
                    int y = pt.get(1).asInt();
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        }
        return (minX == Integer.MAX_VALUE) ? new int[]{0, 0, 0, 0} : new int[]{minX, minY, maxX, maxY};
    }

    /** Returns the area of the intersection of two AABBs [minX, minY, maxX, maxY]. */
    private double overlapArea(int[] a, int[] b) {
        int ox = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]));
        int oy = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
        return (double) ox * oy;
    }

    private JsonNode parseJsonOrNull(String json) {
        if (json == null || json.isBlank()) {
            return objectMapper.nullNode();
        }
        try {
            return objectMapper.readTree(json);
        } catch (IOException e) {
            return objectMapper.nullNode();
        }
    }

    private JsonNode withSequentialBoxIds(JsonNode ppocrLineData) {
        if (ppocrLineData == null || !ppocrLineData.isArray()) {
            return objectMapper.nullNode();
        }
        int i = 1;
        for (JsonNode node : ppocrLineData) {
            if (node instanceof ObjectNode obj) {
                obj.put("boxId", "b" + i++);
            }
        }
        return ppocrLineData;
    }

    private JsonNode simplifyPpocrLineData(JsonNode ppocrLineData) {
        if (ppocrLineData == null || !ppocrLineData.isArray()) {
            return objectMapper.createArrayNode();
        }
        com.fasterxml.jackson.databind.node.ArrayNode out = objectMapper.createArrayNode();
        for (JsonNode node : ppocrLineData) {
            if (!(node instanceof ObjectNode obj)) {
                continue;
            }
            ObjectNode simple = objectMapper.createObjectNode();
            simple.put("boxId", obj.path("boxId").asText(""));
            simple.set("cnt", obj.path("cnt").deepCopy());
            simple.put("text", obj.path("text").asText(""));
            out.add(simple);
        }
        return out;
    }

}
