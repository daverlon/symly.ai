package app.symbiol.backend.api;

import java.io.IOException;
import java.util.List;

import org.springframework.security.core.Authentication;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartFile;

import app.symbiol.backend.dto.ImageUploadResponseDto;
import app.symbiol.backend.dto.NotificationMesageType;
import app.symbiol.backend.dto.SessionDto;
import app.symbiol.backend.dto.SessionIdDto;
import app.symbiol.backend.dto.UploadSessionDto;
import app.symbiol.backend.dto.UploadSessionKeyDto;
import app.symbiol.backend.exception.InvalidUploadImageTypeException;
import app.symbiol.backend.exception.SessionNotFoundException;
import app.symbiol.backend.model.Session;
import app.symbiol.backend.model.UploadSessionKey;
import app.symbiol.backend.service.ImageUploadService;
import app.symbiol.backend.service.LocalImageStorageService;
import app.symbiol.backend.service.NotificationService;
import app.symbiol.backend.service.SessionService;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
public class SessionController {

    private final SessionService sessionService;

    private final LocalImageStorageService imageStorageService;
    private final ImageUploadService imageUploadService;

    private final NotificationService notificationService;

    public SessionController(
        SessionService sessionService,
        ImageUploadService imageUploadService,
        NotificationService notificationService

    ) {
        this.sessionService = sessionService;
        this.imageUploadService = imageUploadService;
        this.imageStorageService = new LocalImageStorageService();
        this.notificationService = notificationService;
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

    /*
        ------------------------------------------

            Deleting sessions:
        
            1. delete upload key 
            2. delete image reference
            3. delete local image
            4. delete session

            To do:

            Move logic outside of controller into a service 
            responsible for deleting sessions

        ------------------------------------------
     */

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
        List<String> fileNames = imageUploadService.getAllImageKeysForPublicSessionId(publicSessionId);
        imageUploadService.deleteAllImagesForPublicSessionId(publicSessionId);
        for (String fn : fileNames) {
            imageStorageService.delete(fn);
        }

        sessionService.deleteSessionForUsername(publicSessionId, username);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/sessions")
    public ResponseEntity<Void> deleteAllSessions(Authentication auth) {
        String username = auth.getName();

        List<String> ids = sessionService.listSessionsForUsername(username).stream().map(Session::getPublicId).toList();
        for (String pId : ids) {
            sessionService.deleteUploadKey(pId);
            List<String> fileNames = imageUploadService.getAllImageKeysForPublicSessionId(pId);
            imageUploadService.deleteAllImagesForPublicSessionId(pId);
            for (String fn : fileNames) {
                imageStorageService.delete(fn);
            }

            sessionService.deleteSessionForUsername(pId, username);
        }

        sessionService.deleteAllSessionsForUsername(username);

        return ResponseEntity.noContent().build();
    }

    /*
        ------------------------------------------
    */

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
                ResponseEntity.ok(new UploadSessionDto(s.getPublicId(), key.getExpiresAt(), s.getAccountOnwerUsername()));

        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
    }

    @PostMapping("/u/{uploadKey}")
    public ResponseEntity<ImageUploadResponseDto>uploadImageFromUploadSession(
        @PathVariable String uploadKey,
        @RequestParam("file") MultipartFile file
    ) throws InvalidUploadImageTypeException, MaxUploadSizeExceededException, IOException {

        try {
            boolean valid = sessionService.isUploadSessionKeyValid(uploadKey);
            if (!valid) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }
            String fileName = imageStorageService.save(file.getBytes(), file.getContentType());
            imageUploadService.SaveImageReferenceForUploadKey(fileName, uploadKey);
            String sessionId = sessionService.findSessionForUploadSessionKey(uploadKey).getPublicId();
            notificationService.notifySessionClients(sessionId, NotificationMesageType.IMAGE_UPLOADED, fileName);

            return
                ResponseEntity.ok(new ImageUploadResponseDto("Image uploaded"));
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
    }
    
}

