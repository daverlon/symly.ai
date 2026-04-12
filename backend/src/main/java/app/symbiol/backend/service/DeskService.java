package app.symbiol.backend.service;

import java.util.List;

import org.springframework.stereotype.Service;

import app.symbiol.backend.exception.SessionNotFoundException;
import app.symbiol.backend.model.DeskImage;
import app.symbiol.backend.model.Session;
import app.symbiol.backend.repository.DeskImageRepository;
import app.symbiol.backend.repository.SessionRepository;

@Service
public class DeskService {

    private final DeskImageRepository deskImageRepository;
    private final SessionRepository sessionRepository;

    public DeskService(
        DeskImageRepository deskImageRepository,
        SessionRepository sessionRepository
    ) {
        this.deskImageRepository = deskImageRepository;
        this.sessionRepository = sessionRepository;
    }

    public List<DeskImage> getDeskImages(String publicSessionId) {
        Session s = sessionRepository.findByPublicId(publicSessionId)
            .orElseThrow(() -> new SessionNotFoundException(publicSessionId));

        List<DeskImage> deskImages = deskImageRepository.findAllBySessionId(s.getId());
        return deskImages;
    }
    
}
