package app.symbiol.backend.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import app.symbiol.backend.model.DeskImage;

@Repository
public interface DeskImageRepository extends JpaRepository<DeskImage, Long> {

    List<DeskImage> findAllBySessionId(long sessionId);

    List<DeskImage> findAllBySessionIdOrderByPositionAsc(long sessionId);

    Optional<DeskImage> findTopBySessionIdOrderByPositionDesc(long sessionId);

    Optional<DeskImage> findByUidAndSessionId(String uid, Long sessionId);

    void deleteByUid(String uid);

}
