package app.symbiol.backend.service;

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import javax.imageio.ImageIO;

import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
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
    private static final Pattern INLINE_MATH_DELIMITER_PATTERN = Pattern.compile("\\$([^$\\n]+)\\$");

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
            return new OcrResult(image.getOcrText(), image.getOcrLineData(), image.getOcrWordData(), null, null, null, null, null, null);
        }

        byte[] imageBytes = imageStorageService.load(image.getFileName());
        String contentType = detectContentType(image.getFileName());

        // Local pipeline: keep PP-OCRv5 raw payload and Mathpix raw payload separate.
        // No bbox merge/enrichment for now.
        if (localOcrService.isEnabled()) {
            log.info("=== PP-OCRv5 + MATHPIX RAW PIPELINE START ===");

            MathpixService.OcrResult local = localOcrService.extractText(imageBytes, contentType);
            MathpixService.OcrResult mathpix = mathpixService.extractText(imageBytes, contentType);
            String mergedRawOutput = buildMergedRawOutput(imageBytes, local.lineDataJson());
            String expressionRawOutput = geminiService.buildExpressionRawOutput(mergedRawOutput);

            String ppocrText = local.text() != null ? local.text() : "";
            String mathpixText = mathpix.text() != null ? mathpix.text() : "";
            String finalText = !mathpixText.isBlank() ? mathpixText : ppocrText;

            image.setOcrText(finalText);
            image.setOcrLineData(local.lineDataJson());
            image.setOcrWordData(local.wordDataJson());
            imageRepository.save(image);
            return new OcrResult(
                image.getOcrText(),
                image.getOcrLineData(),
                image.getOcrWordData(),
                mathpixText,
                ppocrText,
                mathpix.lineDataJson(),
                mathpix.wordDataJson(),
                mergedRawOutput,
                expressionRawOutput
            );
        }

        // Fallback to Mathpix only
        MathpixService.OcrResult raw = mathpixService.extractText(imageBytes, contentType);

        image.setOcrText(raw.text() != null ? raw.text() : "");
        image.setOcrLineData(raw.lineDataJson());
        image.setOcrWordData(raw.wordDataJson());
        imageRepository.save(image);

        return new OcrResult(
            image.getOcrText(),
            image.getOcrLineData(),
            image.getOcrWordData(),
            raw.mathpixText(),
            null,
            raw.lineDataJson(),
            raw.wordDataJson(),
            null,
            null
        );
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
        imageRepository.save(image);
    }

    private static String detectContentType(String fileName) {
        String lower = fileName.toLowerCase();
        if (lower.endsWith(".png")) return "image/png";
        return "image/jpeg";
    }

    private String buildMergedRawOutput(byte[] imageBytes, String lineDataJson) {
        if (lineDataJson == null || lineDataJson.isBlank()) {
            return "[]";
        }

        try {
            JsonNode root = objectMapper.readTree(lineDataJson);
            if (!root.isArray()) {
                return "[]";
            }

            BufferedImage originalImage = ImageIO.read(new ByteArrayInputStream(imageBytes));
            if (originalImage == null) {
                return "[]";
            }

            ArrayNode merged = objectMapper.createArrayNode();
            int idx = 1;
            for (JsonNode node : root) {
                JsonNode cnt = node.get("cnt");
                if (cnt == null || !cnt.isArray() || cnt.size() < 4) {
                    continue;
                }

                int minX = Integer.MAX_VALUE;
                int minY = Integer.MAX_VALUE;
                int maxX = Integer.MIN_VALUE;
                int maxY = Integer.MIN_VALUE;
                for (JsonNode point : cnt) {
                    if (!point.isArray() || point.size() < 2) {
                        continue;
                    }
                    int x = point.get(0).asInt();
                    int y = point.get(1).asInt();
                    minX = Math.min(minX, x);
                    minY = Math.min(minY, y);
                    maxX = Math.max(maxX, x);
                    maxY = Math.max(maxY, y);
                }

                if (minX == Integer.MAX_VALUE || minY == Integer.MAX_VALUE) {
                    continue;
                }

                int margin = 8;
                minX = Math.max(0, minX - margin);
                minY = Math.max(0, minY - margin);
                maxX = Math.min(originalImage.getWidth(), maxX + margin);
                maxY = Math.min(originalImage.getHeight(), maxY + margin);

                int width = maxX - minX;
                int height = maxY - minY;
                if (width <= 0 || height <= 0) {
                    continue;
                }

                BufferedImage cropped = originalImage.getSubimage(minX, minY, width, height);
                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                ImageIO.write(cropped, "png", baos);
                String mathpixRegionText = mathpixService.extractTextOnly(baos.toByteArray(), "image/png");

                ObjectNode item = objectMapper.createObjectNode();
                item.put("boxId", "b" + idx++);
                item.set("cnt", cnt.deepCopy());
                item.put("text", normalizeMathpixText(mathpixRegionText));
                merged.add(item);
            }

            return objectMapper.writeValueAsString(merged);
        } catch (IOException e) {
            log.error("Failed to build merged raw output", e);
            return "[]";
        }
    }

    private String normalizeMathpixText(String text) {
        if (text == null) {
            return "";
        }
        String trimmed = text.trim();
        if (trimmed.startsWith("$$") && trimmed.endsWith("$$") && trimmed.length() >= 4) {
            return trimmed.substring(2, trimmed.length() - 2).trim();
        }
        if (trimmed.startsWith("$") && trimmed.endsWith("$") && trimmed.length() >= 2) {
            trimmed = trimmed.substring(1, trimmed.length() - 1).trim();
        }

        // Remove inline $...$ math delimiters while preserving likely currency.
        Matcher matcher = INLINE_MATH_DELIMITER_PATTERN.matcher(trimmed);
        StringBuffer sb = new StringBuffer();
        while (matcher.find()) {
            String inner = matcher.group(1);
            if (looksLikeCurrency(inner)) {
                matcher.appendReplacement(sb, Matcher.quoteReplacement(matcher.group(0)));
            } else {
                matcher.appendReplacement(sb, Matcher.quoteReplacement(inner.trim()));
            }
        }
        matcher.appendTail(sb);
        return sb.toString().trim();
    }

    private boolean looksLikeCurrency(String inner) {
        String s = inner.trim();
        // Keep patterns such as "$5", "$12.50", "$1,200.00"
        return s.matches("\\d{1,3}(,\\d{3})*(\\.\\d{1,2})?");
    }

}
