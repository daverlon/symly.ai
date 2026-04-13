package app.symbiol.backend.service;

import java.util.List;

import org.springframework.stereotype.Service;

import app.symbiol.backend.dto.DeskImageDto;
import app.symbiol.backend.exception.ImageNotFoundException;
import app.symbiol.backend.exception.SessionNotFoundException;
import app.symbiol.backend.model.DeskImage;
import app.symbiol.backend.model.Image;
import app.symbiol.backend.model.Session;
import app.symbiol.backend.repository.DeskImageRepository;
import app.symbiol.backend.repository.ImageRepository;
import app.symbiol.backend.repository.SessionRepository;

@Service
public class DeskService {

    private final DeskImageRepository deskImageRepository;
    private final SessionRepository sessionRepository;
    private final ImageRepository imageRepository;

    public DeskService(
        DeskImageRepository deskImageRepository,
        SessionRepository sessionRepository,
        ImageRepository imageRepository
   ) {
        this.deskImageRepository = deskImageRepository;
        this.sessionRepository = sessionRepository;
        this.imageRepository = imageRepository;
    }

    public List<DeskImage> getDeskImages(String publicSessionId) {
        Session s = sessionRepository.findByPublicId(publicSessionId)
            .orElseThrow(() -> new SessionNotFoundException(publicSessionId));

        List<DeskImage> deskImages = deskImageRepository.findAllBySessionId(s.getId());
        return deskImages;
    }

    public void createDeskImage(String publicSessionId, DeskImageDto data) {

        Session s = sessionRepository.findByPublicId(publicSessionId)
            .orElseThrow(() -> new SessionNotFoundException(publicSessionId));

        Image i = imageRepository.findByFileName(data.getName())
            .orElseThrow(() -> new ImageNotFoundException(publicSessionId));

        DeskImage image = new DeskImage(
            s, i, data.getPosition()
        );
        deskImageRepository.save(image);
    }
    
}
