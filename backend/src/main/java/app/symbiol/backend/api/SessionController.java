package app.symbiol.backend.api;

import java.io.IOException;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import org.springframework.security.core.Authentication;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartFile;

import app.symbiol.backend.dto.DeskImageDto;
import app.symbiol.backend.dto.ImageUploadResponseDto;
import app.symbiol.backend.dto.NotificationMesageType;
import app.symbiol.backend.dto.SessionDto;
import app.symbiol.backend.dto.SessionIdDto;
import app.symbiol.backend.dto.SessionImageDto;
import app.symbiol.backend.dto.UploadSessionDto;
import app.symbiol.backend.dto.UploadSessionKeyDto;
import app.symbiol.backend.exception.InvalidUploadImageTypeException;
import app.symbiol.backend.exception.SessionNotFoundException;
import app.symbiol.backend.model.DeskImage;
import app.symbiol.backend.model.Image;
import app.symbiol.backend.model.Session;
import app.symbiol.backend.model.UploadSessionKey;
import app.symbiol.backend.service.DeskService;
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

    private final DeskService deskService;

    public SessionController(
        SessionService sessionService,
        ImageUploadService imageUploadService,
        NotificationService notificationService,
        DeskService deskService

    ) {
        this.sessionService = sessionService;
        this.imageUploadService = imageUploadService;
        this.imageStorageService = new LocalImageStorageService();
        this.notificationService = notificationService;
        this.deskService = deskService;
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

    // todo - fetch images and desk stuff here instead
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

            List<DeskImage> images = deskService.getDeskImages(publicSessionId);
            List<DeskImageDto> imagesDto = IntStream.range(0, images.size()) 
                .mapToObj(i -> {
                    DeskImage img = images.get(i);
                    DeskImageDto dto = new DeskImageDto(img.getFileName(), i, img.getUid());
                    return dto;
                })
                .toList();
            

            SessionDto res = new SessionDto(s.getCreationDate(), imagesDto);

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
        
            - delete upload key
            - delete desk image
            - delete image reference
            - delete local image
            - delete session

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

        deskService.deleteAllDeskImages(publicSessionId);

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
            deskService.deleteAllDeskImages(pId);
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

    @GetMapping("/sessions/{publicSessionId}/images")
    public ResponseEntity<List<SessionImageDto>> getAllSessionImages(
        @PathVariable String publicSessionId,
        Authentication auth
    ) {
        List<Image> images = imageUploadService.getAllImagesForPublicSessionId(publicSessionId);
        if (images.isEmpty()) {
            return ResponseEntity.noContent().build();
        }

        List<SessionImageDto> imageDtos = images.stream()
            .map( i -> {

                String url = String.format("http://localhost:8080/sessions/%s/images/%s", publicSessionId, i.getFileName());

                SessionImageDto dto = new SessionImageDto();
                dto.setName(i.getFileName());
                dto.setUploadDate(i.getUploadDate());
                dto.setUrl(url);
                return dto;
            })
            .collect(Collectors.toList());


        return ResponseEntity.ok(imageDtos);
    }

    @GetMapping("/sessions/{publicSessionId}/images/{imageName}")
    public ResponseEntity<byte[]> getSessionImage(
        @PathVariable String publicSessionId,
        @PathVariable String imageName,
        Authentication auth
    ) {
        // already have image key (file name)

        // SessionImageDto dto = new SessionImageDto();
        // dto.setImage(imageStorageService.load(imageName));
        // dto.setName(imageName);
        byte[] image = imageStorageService.load(imageName);


        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + imageName + "\"")
            .contentType(MediaType.IMAGE_PNG)
            .body(image);
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
            SessionImageDto dto = imageUploadService.SaveImageReferenceForUploadKey(fileName, uploadKey);
            log.info("Send client: " + dto.toString());
            String sessionId = sessionService.findSessionForUploadSessionKey(uploadKey).getPublicId();

            notificationService.notifySessionClients(sessionId, NotificationMesageType.IMAGE_UPLOADED, dto);

            return
                ResponseEntity.ok(new ImageUploadResponseDto("Image uploaded"));
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
    }
    
}

