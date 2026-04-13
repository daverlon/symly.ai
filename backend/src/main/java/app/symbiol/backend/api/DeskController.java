package app.symbiol.backend.api;

import java.util.List;
import java.util.stream.IntStream;

import org.apache.catalina.connector.Response;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import app.symbiol.backend.dto.DeskImageDto;
import app.symbiol.backend.model.DeskImage;
import app.symbiol.backend.service.DeskService;
import app.symbiol.backend.service.SessionService;

@RestController
@RequestMapping("/sessions/{publicSessionId}/desk-images")
public class DeskController {

    private final SessionService sessionService;
    private final DeskService deskService;

    public DeskController(
        SessionService sessionService,
        DeskService deskService
    ) {
        this.sessionService = sessionService;
        this.deskService = deskService;
    }

    @PostMapping
    public ResponseEntity<String> addDeskImage(
        @PathVariable String publicSessionId,
        @RequestBody DeskImageDto dto,
        Authentication authentication
    ) {
        deskService.createDeskImage(publicSessionId, dto);
        return ResponseEntity.ok().build();
    }

    @Deprecated
    @GetMapping("/images")
    public ResponseEntity<List<DeskImageDto>> getDeskImages(
        @PathVariable String publicSessionId,
        Authentication authentication
    ) {
        assert(false);

        List<DeskImage> images = deskService.getDeskImages(publicSessionId);
        if (images.isEmpty()) { 
            return ResponseEntity.noContent().build();
        }

        List<DeskImageDto> imagesDto = IntStream.range(0, images.size())
                .mapToObj(i -> {
                    DeskImage img = images.get(i);
                    DeskImageDto dto = new DeskImageDto(img.getFileName(), i);
                    return dto;
                })
                .toList();

        return ResponseEntity.ok(imagesDto);
    }
}