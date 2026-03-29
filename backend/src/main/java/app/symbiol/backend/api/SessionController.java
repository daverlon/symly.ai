package app.symbiol.backend.api;

import java.util.List;

import org.springframework.security.core.Authentication;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RestController;

import app.symbiol.backend.dto.SessionDto;
import app.symbiol.backend.dto.SessionIdDto;
import app.symbiol.backend.dto.UploadSessionDto;
import app.symbiol.backend.dto.UploadSessionKeyDto;
import app.symbiol.backend.exception.SessionNotFoundException;
import app.symbiol.backend.model.Session;
import app.symbiol.backend.model.UploadSessionKey;
import app.symbiol.backend.service.SessionService;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
public class SessionController {

    private final SessionService sessionService;

    public SessionController(SessionService sessionService) {
        this.sessionService = sessionService;
    }

    @PostMapping("/sessions")
    public ResponseEntity<SessionIdDto> createSession(Authentication auth) {

        String username = auth.getName();

        Session session = sessionService.createSessionForUsername(username);
        return ResponseEntity.ok(new SessionIdDto(session.getPublicId(), session.getCreationDate()));
    }

    @GetMapping("/sessions")
    public ResponseEntity<List<SessionIdDto>> listSessions(Authentication auth) {
        String username = auth.getName();

        return ResponseEntity.ok(
            sessionService.listSessionsForUsername(username).stream()
                .map(s -> 
                    new SessionIdDto(
                        s.getPublicId(), 
                        s.getCreationDate()
                    )
                )
                .toList()
        );
    }

    @PostMapping("/sessions/{sessionId}/uploadKey")
    public ResponseEntity<UploadSessionKeyDto> createSessionUploadKey(
        @PathVariable String sessionId
    ) {
        UploadSessionKeyDto key = sessionService.createUploadSessionKey(sessionId);
        return ResponseEntity.ok(key);
    }

    @GetMapping("/sessions/{publicSessionId}")
    public ResponseEntity<SessionDto> getSessionData(
        @PathVariable String publicSessionId,
        Authentication auth
    ) {
        String username = auth.getName();

        try {
            Session s = sessionService.findSessionForUsername(publicSessionId, username)
                .orElseThrow(() -> new SessionNotFoundException(publicSessionId));

            SessionDto res = new SessionDto("Hello, World!", s.getCreationDate());

            return ResponseEntity.ok(res);

        } catch (SessionNotFoundException ex) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        } catch (Exception ex) {
            log.error(ex.toString());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();

        }
    }

    @DeleteMapping("/sessions/{publicSessionId}")
    public ResponseEntity<Void> deleteSession(
        @PathVariable String publicSessionId,
        Authentication auth
    ) {
        String username = auth.getName();

        if (sessionService.findSessionForUsername(publicSessionId, username).isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }

        sessionService.deleteUploadKey(publicSessionId);
        sessionService.deleteSessionForUsername(publicSessionId, username);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/sessions")
    public ResponseEntity<Void> deleteAllSessions(Authentication auth) {
        String username = auth.getName();

        sessionService.deleteAllSessionsForUsername(username);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/u/{uploadKey}")
    public ResponseEntity<UploadSessionDto>getUploadSessionData(
        @PathVariable String uploadKey
    ) {
        // check if upload key is valid
        // should throw exception regardless
        try {
            boolean valid = sessionService.isUploadSessionKeyValid(uploadKey);

            if (!valid) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }

            UploadSessionKey key = sessionService.findUploadSessionKey(uploadKey);
            Session s = sessionService.findSessionForUploadSessionKey(uploadKey);
            return 
                ResponseEntity.ok(new UploadSessionDto(s.getPublicId(), key.getExpiresAt(), "placeholder"));

        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
    }
}

