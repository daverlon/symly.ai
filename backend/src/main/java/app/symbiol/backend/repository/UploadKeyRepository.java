package app.symbiol.backend.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import app.symbiol.backend.model.Session;
import app.symbiol.backend.model.UploadSessionKey;

@Repository
public interface UploadKeyRepository extends JpaRepository<UploadSessionKey, Long> {

    public Optional<UploadSessionKey> findByKey(String key);

    public void deleteBySessionId(Long sessionId);
    public void deleteBySession(Session session);
}
