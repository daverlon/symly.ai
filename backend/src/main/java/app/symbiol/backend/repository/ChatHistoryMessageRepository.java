package app.symbiol.backend.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import app.symbiol.backend.model.ChatHistoryMessage;

public interface ChatHistoryMessageRepository extends JpaRepository<ChatHistoryMessage, Long> {

    List<ChatHistoryMessage> findAllByDeskImage_UidOrderByPositionAsc(String uid);

    void deleteAllByDeskImage_Uid(String uid);

    int countByDeskImage_Uid(String uid);
}
