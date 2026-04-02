package app.symbiol.backend.api;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import app.symbiol.backend.service.NotificationService;

@RestController
@RequestMapping("/stream")
public class StreamController {

    private final NotificationService notificationService;

    public StreamController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping("/{sessionId}")
    public SseEmitter stream(@PathVariable String sessionId) {
        return notificationService.registerClient(sessionId);
    }
}
