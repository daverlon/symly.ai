package app.symbiol.backend.service;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

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

    public DeskService(
        DeskImageRepository deskImageRepository,
        SessionRepository sessionRepository,
        ImageRepository imageRepository,
        ImageStorageService imageStorageService,
        MathpixService mathpixService,
        LocalOcrService localOcrService
   ) {
        this.deskImageRepository = deskImageRepository;
        this.sessionRepository = sessionRepository;
        this.imageRepository = imageRepository;
        this.imageStorageService = imageStorageService;
        this.mathpixService = mathpixService;
        this.localOcrService = localOcrService;
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

    public record OcrResult(String text, String lineDataJson, String wordDataJson) {}

    /** Returns the Mathpix OCR result for the given desk image, caching on the Image row. */
    @Transactional
    public OcrResult getOcrResult(String publicSessionId, String uid, String username) {
        Session s = sessionRepository.findByPublicIdAndAccount_Username(publicSessionId, username)
                .orElseThrow(() -> new SessionNotFoundException(publicSessionId));

        DeskImage deskImage = deskImageRepository.findByUidAndSessionId(uid, s.getId())
                .orElseThrow(() -> new ImageNotFoundException(uid));

        Image image = deskImage.getImage();

        if (image.getOcrText() != null) {
            return new OcrResult(image.getOcrText(), image.getOcrLineData(), image.getOcrWordData());
        }

        byte[] imageBytes = imageStorageService.load(image.getFileName());
        String contentType = detectContentType(image.getFileName());
        MathpixService.OcrResult raw = localOcrService.isEnabled()
                ? localOcrService.extractText(imageBytes, contentType)
                : mathpixService.extractText(imageBytes, contentType);

        image.setOcrText(raw.text() != null ? raw.text() : "");
        image.setOcrLineData(raw.lineDataJson());
        image.setOcrWordData(raw.wordDataJson());
        imageRepository.save(image);

        return new OcrResult(image.getOcrText(), image.getOcrLineData(), image.getOcrWordData());
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

}
