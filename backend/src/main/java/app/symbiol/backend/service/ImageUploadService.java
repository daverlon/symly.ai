package app.symbiol.backend.service;

import app.symbiol.backend.dto.SessionImageDto;
import app.symbiol.backend.exception.InvalidUploadSessionKeyException;
import app.symbiol.backend.exception.SessionNotFoundException;
import app.symbiol.backend.model.Image;
import app.symbiol.backend.model.Session;
import app.symbiol.backend.model.UploadSessionKey;
import app.symbiol.backend.repository.ImageRepository;
import app.symbiol.backend.repository.SessionRepository;
import app.symbiol.backend.repository.UploadKeyRepository;

import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ImageUploadService {

    private final UploadKeyRepository uploadKeyRepository;
    private final SessionRepository sessionRepository;
    private final ImageRepository imageRepository;

    public ImageUploadService(
        UploadKeyRepository uploadKeyRepository,
        SessionRepository sessionRepository,
        ImageRepository imageRepository
    ) {
        this.uploadKeyRepository = uploadKeyRepository;
        this.sessionRepository = sessionRepository;
        this.imageRepository = imageRepository;
    }

    @Transactional
    public SessionImageDto SaveImageReferenceForUploadKey(
        String fileName,
        String uploadKey
    ) {
        UploadSessionKey ukey = uploadKeyRepository
            .findByKey(uploadKey)
            .orElseThrow(() -> new InvalidUploadSessionKeyException(uploadKey));
        Session s = ukey.getSession();
        Image i = new Image(s, fileName);
        imageRepository.save(i);

        SessionImageDto dto = new SessionImageDto();
        dto.setName(fileName);
        dto.setUploadDate(i.getUploadDate());
        String url = String.format("http://localhost:8080/sessions/%s/images/%s", s.getPublicId(), i.getFileName());
        dto.setUrl(url);
        return dto;
    }

    // only delete db references to the images on disk
    // the images are deleted by the storage service
    @Transactional
    public void deleteAllImagesForPublicSessionId(String publicSessionId) {
        Session s = sessionRepository
            .findByPublicId(publicSessionId)
            .orElseThrow(() -> new SessionNotFoundException(publicSessionId));
        imageRepository.deleteBySession(s);
    }

    @Transactional(readOnly = true)
    public List<String> getAllImageKeysForPublicSessionId(
        String publicSessionId
    ) {
        Session s = sessionRepository
            .findByPublicId(publicSessionId)
            .orElseThrow(() -> new SessionNotFoundException(publicSessionId));

        List<Image> images = imageRepository.findBySession(s);

        return images.stream().map(Image::getFileName).toList();
    }

    @Transactional(readOnly = true)
    public List<Image> getAllImagesForPublicSessionId(String publicSessionId) {
        Session s = sessionRepository
            .findByPublicId(publicSessionId)
            .orElseThrow(() -> new SessionNotFoundException(publicSessionId));

        return imageRepository.findBySession(s);
    }

    @Transactional(readOnly = true)
    public Instant getImageDateForFileName(String fileName) {
        Image i = imageRepository.findByFileName(fileName);
        return i.getUploadDate();
    }
}
