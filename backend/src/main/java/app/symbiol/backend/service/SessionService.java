package app.symbiol.backend.service;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Service;

import app.symbiol.backend.dto.UploadSessionKeyDto;
import app.symbiol.backend.exception.AccountNotFoundException;
import app.symbiol.backend.exception.InvalidUploadSessionKeyException;
import app.symbiol.backend.exception.SessionNotFoundException;
import app.symbiol.backend.model.Account;
import app.symbiol.backend.model.Session;
import app.symbiol.backend.model.UploadSessionKey;
import app.symbiol.backend.repository.AccountRepository;
import app.symbiol.backend.repository.SessionRepository;
import app.symbiol.backend.repository.UploadKeyRepository;
import jakarta.transaction.Transactional;

@Service
@Transactional
public class SessionService {

    private final AccountRepository accountRepository;
    private final SessionRepository sessionRepository;
    private final UploadKeyRepository uploadKeyRepository;

    private final SecureRandom random = new SecureRandom();

    public SessionService(

        AccountRepository accountRepository, 
        SessionRepository sessionRepository, 
        UploadKeyRepository uploadKeyRepository) {

        this.accountRepository = accountRepository;
        this.sessionRepository = sessionRepository;
        this.uploadKeyRepository = uploadKeyRepository;
    }

    public Session createSessionForUsername(String username) {
        Account account = accountRepository.findByUsername(username)
            .orElseThrow(() -> new AccountNotFoundException(username));
        Session session = new Session(account);
        return sessionRepository.save(session);
    }

    public List<Session> listSessionsForUsername(String username) {
        Account account = accountRepository.findByUsername(username)
            .orElseThrow(() -> new AccountNotFoundException(username));
        return sessionRepository.findByAccount(account);
    }

    public Optional<Session> findSessionForUsername(Long sessionId, String username) {
        Account account = accountRepository.findByUsername(username)
            .orElseThrow(() -> new AccountNotFoundException(username));
        return sessionRepository.findByIdAndAccount(sessionId, account);
    }

    public void deleteSessionForUsername(Long sessionId, String username) {
        Session session = findSessionForUsername(sessionId, username)
            .orElseThrow(() -> new AccountNotFoundException(username));
        sessionRepository.delete(session);
    }

    public void deleteAllSessionsForUsername(String username) {
        List<Session> sessions = listSessionsForUsername(username);
        for (int i = 0; i < sessions.size(); i++) {
            Long id = sessions.get(i).getId();
            uploadKeyRepository.deleteBySessionId(id);
        }
        sessionRepository.deleteAll(sessions);
    }

    public UploadSessionKeyDto createUploadSessionKey(String publicId) {

        // create the upload session key in the DB, it lasts 1 hour

        Session correspondingSession = sessionRepository.findByPublicId(publicId)
            .orElseThrow(() -> new SessionNotFoundException(publicId));


        byte[] bytes = new byte[16];
        random.nextBytes(bytes);
        String uploadKey = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        UploadSessionKeyDto key = new UploadSessionKeyDto(uploadKey, "/u/" + uploadKey);

        UploadSessionKey uploadSessionKey = new UploadSessionKey(
            correspondingSession, 
            uploadKey,
            Instant.now().plusSeconds(3600)); // 1 hour session

        uploadKeyRepository.save(uploadSessionKey);

        return key;
    }

    public void deleteUploadKey(Long sessionId) {
        uploadKeyRepository.deleteBySessionId(sessionId);
    }

    public boolean isUploadSessionKeyValid(String uploadSessionKey) {
        UploadSessionKey key = uploadKeyRepository.findByKey(uploadSessionKey)
            .orElseThrow(() -> new InvalidUploadSessionKeyException(uploadSessionKey));
        if (key.isExpired()) {
            throw new InvalidUploadSessionKeyException(uploadSessionKey);
        }
        return true;
    }

    public Session findSessionForUploadSessionKey(String uploadSessionKey) {
        UploadSessionKey k = uploadKeyRepository.findByKey(uploadSessionKey)
            .orElseThrow(() -> new InvalidUploadSessionKeyException(uploadSessionKey));
        return k.getSession();
    }

    public UploadSessionKey findUploadSessionKey(String uploadKey) {
        return uploadKeyRepository.findByKey(uploadKey)
            .orElseThrow(() -> new InvalidUploadSessionKeyException(uploadKey));
    }
}

