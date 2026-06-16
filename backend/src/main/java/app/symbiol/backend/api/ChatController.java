package app.symbiol.backend.api;

import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import app.symbiol.backend.dto.ChatMessageDto;
import app.symbiol.backend.dto.ChatRequestDto;
import app.symbiol.backend.service.ChatService;
import app.symbiol.backend.service.DeskService;
import app.symbiol.backend.service.GeminiService;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/sessions/{publicSessionId}/desk-images/{uid}/chat")
public class ChatController {

    private final DeskService deskService;
    private final GeminiService geminiService;
    private final ChatService chatService;

    public ChatController(DeskService deskService, GeminiService geminiService, ChatService chatService) {
        this.deskService = deskService;
        this.geminiService = geminiService;
        this.chatService = chatService;
    }

    @GetMapping
    public ResponseEntity<List<ChatMessageDto>> getHistory(
            @PathVariable String publicSessionId,
            @PathVariable String uid,
            Authentication authentication) {
        String username = authentication.getName();
        List<ChatMessageDto> history = chatService.getHistory(publicSessionId, uid, username);
        return ResponseEntity.ok(history);
    }

    @PostMapping
    public ResponseEntity<Map<String, String>> chat(
            @PathVariable String publicSessionId,
            @PathVariable String uid,
            @RequestBody ChatRequestDto dto,
            Authentication authentication) {
        String username = authentication.getName();

        DeskService.OcrResult ocr = deskService.getOcrResult(publicSessionId, uid, username);
        String systemPrompt = geminiService.buildSystemPrompt(ocr.text(), ocr.lineDataJson());
        String reply = geminiService.chat(systemPrompt, dto.getMessages());

        if (reply == null) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Failed to get a response from Gemini."));
        }

        // Persist only the latest user turn + reply (history already contains prior turns)
        List<ChatMessageDto> msgs = dto.getMessages();
        String userContent = msgs.isEmpty() ? "" : msgs.get(msgs.size() - 1).getContent();
        chatService.appendExchange(publicSessionId, uid, username, userContent, reply);

        return ResponseEntity.ok(Map.of("reply", reply));
    }

    @DeleteMapping
    public ResponseEntity<Void> deleteHistory(
            @PathVariable String publicSessionId,
            @PathVariable String uid,
            Authentication authentication) {
        String username = authentication.getName();
        chatService.deleteHistory(publicSessionId, uid, username);
        return ResponseEntity.noContent().build();
    }
}
