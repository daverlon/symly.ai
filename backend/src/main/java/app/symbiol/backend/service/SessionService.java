package app.symbiol.backend.service;

import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Service;

import app.symbiol.backend.exception.AccountNotFoundException;
import app.symbiol.backend.model.Account;
import app.symbiol.backend.model.Session;
import app.symbiol.backend.repository.AccountRepository;
import app.symbiol.backend.repository.SessionRepository;

@Service
public class SessionService {

    private final AccountRepository accountRepository;
    private final SessionRepository sessionRepository;

    public SessionService(AccountRepository accountRepository, SessionRepository sessionRepository) {
        this.accountRepository = accountRepository;
        this.sessionRepository = sessionRepository;
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
        sessionRepository.deleteAll(sessions);
    }
}

