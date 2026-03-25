package app.symbiol.backend.api;

import java.util.List;

import org.apache.catalina.connector.Response;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import app.symbiol.backend.dto.SessionIdDto;
import app.symbiol.backend.dto.UploadSessionDto;
import app.symbiol.backend.dto.UploadSessionJwtDto;
import app.symbiol.backend.dto.UploadSessionKeyDto;
import app.symbiol.backend.dto.UploadSessionValidateDto;
import app.symbiol.backend.model.Session;
import app.symbiol.backend.model.UploadSessionKey;
import app.symbiol.backend.security.JwtService;
import app.symbiol.backend.service.SessionService;
import io.jsonwebtoken.JwtException;

@RestController
public class SessionController {

    private final JwtService jwtService;
    private final SessionService sessionService;

    public SessionController(JwtService jwtService, SessionService sessionService) {
        this.jwtService = jwtService;
        this.sessionService = sessionService;
    }

    private String extractBearerToken(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return null;
        }
        return authHeader.substring(7);
    }

    @PostMapping("/sessions")
    public ResponseEntity<SessionIdDto> createSession(@RequestHeader("Authorization") String authHeader) {
        String token = extractBearerToken(authHeader);
        if (token == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        try {
            String username = jwtService.validateTokenAndGetUsername(token);
            Session session = sessionService.createSessionForUsername(username);
            return ResponseEntity.ok(new SessionIdDto(session.getPublicId()));
        } catch (JwtException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
    }

    @GetMapping("/sessions")
    public ResponseEntity<List<SessionIdDto>> listSessions(@RequestHeader("Authorization") String authHeader) {
        String token = extractBearerToken(authHeader);
        if (token == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        try {
            String username = jwtService.validateTokenAndGetUsername(token);
            return ResponseEntity.ok(
                sessionService.listSessionsForUsername(username).stream()
                    .map(s -> new SessionIdDto(s.getPublicId()))
                    .toList()
            );
        } catch (JwtException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
    }

    @PostMapping("/sessions/{sessionId}/uploadKey")
    public ResponseEntity<UploadSessionKeyDto> createSessionUploadKey(
        @PathVariable String sessionId,
        @RequestHeader("Authorization") String authHeader
    ) {
        String token = extractBearerToken(authHeader);
        if (token == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        try {
            UploadSessionKeyDto key = sessionService.createUploadSessionKey(sessionId);
            return ResponseEntity.ok(key);
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @DeleteMapping("/sessions/{sessionId}")
    public ResponseEntity<Void> deleteSession(
        @PathVariable Long sessionId,
        @RequestHeader("Authorization") String authHeader
    ) {
        String token = extractBearerToken(authHeader);
        if (token == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        try {
            String username = jwtService.validateTokenAndGetUsername(token);
            if (sessionService.findSessionForUsername(sessionId, username).isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
            }

            sessionService.deleteUploadKey(sessionId);
            sessionService.deleteSessionForUsername(sessionId, username);
            return ResponseEntity.noContent().build();
        } catch (JwtException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
    }

    @DeleteMapping("/sessions")
    public ResponseEntity<Void> deleteAllSessions(@RequestHeader("Authorization") String authHeader) {
        String token = extractBearerToken(authHeader);
        if (token == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        try {
            String username = jwtService.validateTokenAndGetUsername(token);
            sessionService.deleteAllSessionsForUsername(username);
            return ResponseEntity.noContent().build();
        } catch (JwtException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
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

