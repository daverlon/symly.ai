package app.symbiol.backend.service;

import org.springframework.stereotype.Service;

import app.symbiol.backend.exception.InvalidUploadSessionKeyException;
import app.symbiol.backend.model.Image;
import app.symbiol.backend.model.Session;
import app.symbiol.backend.model.UploadSessionKey;
import app.symbiol.backend.repository.ImageRepository;
import app.symbiol.backend.repository.SessionRepository;
import app.symbiol.backend.repository.UploadKeyRepository;

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

    public void SaveImageReferenceForUploadKey(String fileName, String uploadKey) {
        UploadSessionKey ukey = uploadKeyRepository.findByKey(uploadKey)
            .orElseThrow(() -> new InvalidUploadSessionKeyException(uploadKey));
        Session s = ukey.getSession();
        Image i = new Image(s, fileName);
        imageRepository.save(i);
    }
    
}
