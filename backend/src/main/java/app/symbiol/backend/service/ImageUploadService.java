package app.symbiol.backend.service;

import java.util.List;

import org.springframework.stereotype.Service;

import app.symbiol.backend.exception.InvalidUploadSessionKeyException;
import app.symbiol.backend.exception.SessionNotFoundException;
import app.symbiol.backend.model.Image;
import app.symbiol.backend.model.Session;
import app.symbiol.backend.model.UploadSessionKey;
import app.symbiol.backend.repository.ImageRepository;
import app.symbiol.backend.repository.SessionRepository;
import app.symbiol.backend.repository.UploadKeyRepository;
import jakarta.transaction.Transactional;

@Service
@Transactional
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

    public void SaveImageReferenceForUploadKey(String fileName, String uploadKey) {
        UploadSessionKey ukey = uploadKeyRepository.findByKey(uploadKey)
            .orElseThrow(() -> new InvalidUploadSessionKeyException(uploadKey));
        Session s = ukey.getSession();
        Image i = new Image(s, fileName);
        imageRepository.save(i);
    }

    // only delete db references to the images on disk
    // the images are deleted by the storage service
    public void deleteAllImagesForPublicSessionId(String publicSessionId) {
        Session s = sessionRepository.findByPublicId(publicSessionId)
            .orElseThrow(() -> new SessionNotFoundException(publicSessionId));
        imageRepository.deleteBySession(s);
    }

    public List<String> getAllImageKeysForPublicSessionId(String publicSessionId) {

        Session s = sessionRepository.findByPublicId(publicSessionId)
            .orElseThrow(() -> new SessionNotFoundException(publicSessionId));

        List<Image> images = imageRepository.findBySession(s);
        
        return images.stream()
            .map(Image::getFileName)
            .toList();
    }
    
}
