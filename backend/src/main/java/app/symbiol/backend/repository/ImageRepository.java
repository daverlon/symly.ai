package app.symbiol.backend.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import app.symbiol.backend.model.Image;
import app.symbiol.backend.model.Session;

@Repository
public interface ImageRepository extends JpaRepository<Image, Long> {
    
    void deleteBySession(Session s);
    void deleteBySessionId(Long sessionId);

    List<Image> findBySession(Session session);
    
}
