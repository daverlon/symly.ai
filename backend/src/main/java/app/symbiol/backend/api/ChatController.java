package app.symbiol.backend.api;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import app.symbiol.backend.dto.ChatRequestDto;
import app.symbiol.backend.service.DeskService;
import app.symbiol.backend.service.GeminiService;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/sessions/{publicSessionId}/desk-images/{uid}/chat")
public class ChatController {

    private final DeskService deskService;
    private final GeminiService geminiService;

    public ChatController(DeskService deskService, GeminiService geminiService) {
        this.deskService = deskService;
        this.geminiService = geminiService;
    }

    @PostMapping
    public ResponseEntity<Map<String, String>> chat(
        @PathVariable String publicSessionId,
        @PathVariable String uid,
        @RequestBody ChatRequestDto dto,
        Authentication authentication
    ) {
        String username = authentication.getName();

        // Load (or lazily trigger) OCR — ownership-verified inside
        DeskService.OcrResult ocr = deskService.getOcrResult(publicSessionId, uid, username);

        String systemPrompt = geminiService.buildSystemPrompt(ocr.text(), ocr.lineDataJson());

        String reply = geminiService.chat(systemPrompt, dto.getMessages());

        if (reply == null) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Failed to get a response from Gemini."));
        }

        return ResponseEntity.ok(Map.of("reply", reply));
    }
}
