package app.symbiol.backend.api;

import app.symbiol.backend.repository.DeskImageRepository;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import app.symbiol.backend.dto.DeskImageDto;
import app.symbiol.backend.dto.DeskImageResponseDto;
import app.symbiol.backend.service.DeskService;
import app.symbiol.backend.service.SessionService;
import jakarta.transaction.Transactional;

@RestController
@RequestMapping("/sessions/{publicSessionId}/desk-images")
public class DeskController {

    private final DeskImageRepository deskImageRepository;
    private final SessionService sessionService;
    private final DeskService deskService;

    public DeskController(
        SessionService sessionService,
        DeskService deskService, DeskImageRepository deskImageRepository
    ) {
        this.sessionService = sessionService;
        this.deskService = deskService;
        this.deskImageRepository = deskImageRepository;
    }

    @PostMapping
    public ResponseEntity<DeskImageResponseDto> addDeskImage(
        @PathVariable String publicSessionId,
        @RequestBody DeskImageDto dto,
        Authentication authentication
    ) {

        // ignore the position sent by the frontend for now, recalculate it in the service
        int position = deskService.createDeskImage(publicSessionId, dto);
        return ResponseEntity.ok().body(new DeskImageResponseDto(position));
    }

    // this skips service layer- todo: add this to service layer
    @Transactional
    @DeleteMapping("/{uid}")
    public ResponseEntity<String> deleteDeskImage(
        @PathVariable String publicSessionId,
        @PathVariable String uid,
        Authentication authentication
    ) {
        deskImageRepository.deleteByUid(uid);
        return ResponseEntity.ok().build();
    }
}