package app.symbiol.backend.service;

import java.util.List;

import org.springframework.stereotype.Service;

import app.symbiol.backend.dto.ChatMessageDto;
import app.symbiol.backend.exception.ImageNotFoundException;
import app.symbiol.backend.exception.SessionNotFoundException;
import app.symbiol.backend.model.ChatHistoryMessage;
import app.symbiol.backend.model.DeskImage;
import app.symbiol.backend.model.Session;
import app.symbiol.backend.repository.ChatHistoryMessageRepository;
import app.symbiol.backend.repository.DeskImageRepository;
import app.symbiol.backend.repository.SessionRepository;
import jakarta.transaction.Transactional;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
public class ChatService {

    private final ChatHistoryMessageRepository chatHistoryMessageRepository;
    private final DeskImageRepository deskImageRepository;
    private final SessionRepository sessionRepository;

    public ChatService(
            ChatHistoryMessageRepository chatHistoryMessageRepository,
            DeskImageRepository deskImageRepository,
            SessionRepository sessionRepository) {
        this.chatHistoryMessageRepository = chatHistoryMessageRepository;
        this.deskImageRepository = deskImageRepository;
        this.sessionRepository = sessionRepository;
    }

    public List<ChatMessageDto> getHistory(String publicSessionId, String uid, String username) {
        verifyOwnership(publicSessionId, uid, username);
        return chatHistoryMessageRepository
                .findAllByDeskImage_UidOrderByPositionAsc(uid)
                .stream()
                .map(m -> new ChatMessageDto(m.getRole(), m.getContent()))
                .toList();
    }

    @Transactional
    public void appendExchange(String publicSessionId, String uid, String username,
                               String userContent, String assistantContent) {
        verifyOwnership(publicSessionId, uid, username);
        DeskImage deskImage = deskImageRepository.findByUidAndSessionId(
                        uid, resolveSession(publicSessionId, username).getId())
                .orElseThrow(() -> new ImageNotFoundException(uid));

        int base = chatHistoryMessageRepository.countByDeskImage_Uid(uid);
        chatHistoryMessageRepository.save(
                new ChatHistoryMessage(deskImage, "user", userContent, base));
        chatHistoryMessageRepository.save(
                new ChatHistoryMessage(deskImage, "assistant", assistantContent, base + 1));
    }

    @Transactional
    public void deleteHistory(String publicSessionId, String uid, String username) {
        verifyOwnership(publicSessionId, uid, username);
        chatHistoryMessageRepository.deleteAllByDeskImage_Uid(uid);
        log.info("Deleted chat history for desk image {}", uid);
    }

    private Session resolveSession(String publicSessionId, String username) {
        return sessionRepository.findByPublicIdAndAccount_Username(publicSessionId, username)
                .orElseThrow(() -> new SessionNotFoundException(publicSessionId));
    }

    private void verifyOwnership(String publicSessionId, String uid, String username) {
        Session s = resolveSession(publicSessionId, username);
        deskImageRepository.findByUidAndSessionId(uid, s.getId())
                .orElseThrow(() -> new ImageNotFoundException(uid));
    }
}
