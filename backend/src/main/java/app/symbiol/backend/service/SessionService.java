package app.symbiol.backend.service;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
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

    @Transactional
    public Session createSessionForUsername(String username) {
        Account account = accountRepository.findByUsername(username)
            .orElseThrow(() -> new AccountNotFoundException(username));
        Session session = new Session(account);
        return sessionRepository.save(session);
    }

    @Transactional(readOnly = true)
    public List<Session> listSessionsForUsername(String username) {
        Account account = accountRepository.findByUsername(username)
            .orElseThrow(() -> new AccountNotFoundException(username));
        return sessionRepository.findByAccount(account);
    }

    @Transactional(readOnly = true)
    public Optional<Session> findSessionForUsername(String publicSessionId, String username) {
        Account account = accountRepository.findByUsername(username)
            .orElseThrow(() -> new AccountNotFoundException(username));
        return sessionRepository.findByPublicIdAndAccount(publicSessionId, account);
    }

    @Transactional
    public void deleteSessionForUsername(String publicSessionId, String username) {
        Session session = findSessionForUsername(publicSessionId, username)
            .orElseThrow(() -> new AccountNotFoundException(username));
        sessionRepository.delete(session);
    }

    @Transactional
    public void deleteAllSessionsForUsername(String username) {
        List<Session> sessions = listSessionsForUsername(username);
        for (int i = 0; i < sessions.size(); i++) {
            Session s = sessions.get(i);
            uploadKeyRepository.deleteBySession(s);
        }
        sessionRepository.deleteAll(sessions);
    }

    @Transactional
    public UploadSessionKeyDto createUploadSessionKey(String publicId) {

        // create the upload session key in the DB, it lasts 1 hour

        Session correspondingSession = sessionRepository.findByPublicId(publicId)
            .orElseThrow(() -> new SessionNotFoundException(publicId));

        // find existing session, if it is valid
        Optional<UploadSessionKey> existingKey = uploadKeyRepository.findTopBySessionIdOrderByExpiresAtDesc(correspondingSession.getId());

        if (existingKey
                .filter(key -> !key.isExpired())
                .isPresent()) {

            UploadSessionKey key = existingKey.get();
            String keyStr = key.getKey();
            return new UploadSessionKeyDto(keyStr, "/u/" + keyStr);
        }

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

    @Transactional
    public void deleteUploadKey(String publicSessionId) {
        Session s = sessionRepository.findByPublicId(publicSessionId)
            .orElseThrow(() -> new InvalidUploadSessionKeyException(publicSessionId));
        uploadKeyRepository.deleteBySession(s);
    }

    @Transactional(readOnly = true)
    public boolean isUploadSessionKeyValid(String uploadSessionKey) {
        UploadSessionKey key = uploadKeyRepository.findByKey(uploadSessionKey)
            .orElseThrow(() -> new InvalidUploadSessionKeyException(uploadSessionKey));
        if (key.isExpired()) {
            throw new InvalidUploadSessionKeyException(uploadSessionKey);
        }
        return true;
    }

    @Transactional(readOnly = true)
    public Session findSessionForUploadSessionKey(String uploadSessionKey) {
        UploadSessionKey k = uploadKeyRepository.findByKey(uploadSessionKey)
            .orElseThrow(() -> new InvalidUploadSessionKeyException(uploadSessionKey));
        return k.getSession();
    }

    @Transactional(readOnly = true)
    public UploadSessionKey findUploadSessionKey(String uploadKey) {
        return uploadKeyRepository.findByKey(uploadKey)
            .orElseThrow(() -> new InvalidUploadSessionKeyException(uploadKey));
    }
}

