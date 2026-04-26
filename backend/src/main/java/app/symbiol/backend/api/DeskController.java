package app.symbiol.backend.api;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import app.symbiol.backend.dto.DeskImageDto;
import app.symbiol.backend.dto.DeskImageResponseDto;
import app.symbiol.backend.dto.MoveDeskImageDto;
import app.symbiol.backend.exception.SessionNotFoundException;
import app.symbiol.backend.service.DeskService;
import app.symbiol.backend.service.SessionService;

@RestController
@RequestMapping("/sessions/{publicSessionId}/desk-images")
public class DeskController {

    private final SessionService sessionService;
    private final DeskService deskService;

    public DeskController(SessionService sessionService, DeskService deskService) {
        this.sessionService = sessionService;
        this.deskService = deskService;
    }

    @PostMapping
    public ResponseEntity<DeskImageResponseDto> addDeskImage(
        @PathVariable String publicSessionId,
        @RequestBody DeskImageDto dto,
        Authentication authentication
    ) {
        String username = authentication.getName();
        sessionService.findSessionForUsername(publicSessionId, username)
                .orElseThrow(() -> new SessionNotFoundException(publicSessionId));

        DeskImageResponseDto ret = deskService.createDeskImage(publicSessionId, dto);
        return ResponseEntity.ok().body(ret);
    }

    @PatchMapping("/{uid}/position")
    public ResponseEntity<Void> moveDeskImage(
        @PathVariable String publicSessionId,
        @PathVariable String uid,
        @RequestBody MoveDeskImageDto dto,
        Authentication authentication
    ) {
        String username = authentication.getName();
        deskService.moveDeskImage(publicSessionId, uid, dto.getAfterUid(), username);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{uid}/ocr")
    public ResponseEntity<Map<String, String>> getOcr(
        @PathVariable String publicSessionId,
        @PathVariable String uid,
        Authentication authentication
    ) {
        String username = authentication.getName();
        DeskService.OcrResult result = deskService.getOcrResult(publicSessionId, uid, username);
        Map<String, String> body = new java.util.HashMap<>();
        body.put("text", result.text() != null ? result.text() : "");
        if (result.lineDataJson() != null) {
            body.put("lineData", result.lineDataJson());
        }
        if (result.wordDataJson() != null) {
            body.put("wordData", result.wordDataJson());
        }
        return ResponseEntity.ok(body);
    }

    @DeleteMapping("/{uid}/ocr")
    public ResponseEntity<Void> clearOcrCache(
        @PathVariable String publicSessionId,
        @PathVariable String uid,
        Authentication authentication
    ) {
        String username = authentication.getName();
        deskService.clearOcrCache(publicSessionId, uid, username);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{uid}")
    public ResponseEntity<Void> deleteDeskImage(
        @PathVariable String publicSessionId,
        @PathVariable String uid,
        Authentication authentication
    ) {
        String username = authentication.getName();
        deskService.deleteDeskImage(publicSessionId, uid, username);
        return ResponseEntity.noContent().build();
    }
}
