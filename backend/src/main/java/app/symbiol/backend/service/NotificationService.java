package app.symbiol.backend.service;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Service
public class NotificationService {

    private final Map<String, List<SseEmitter>> sessionEmitters = new ConcurrentHashMap<>();

    public SseEmitter registerClient(String sessionId) {
        SseEmitter emitter = new SseEmitter(0L);
        sessionEmitters.computeIfAbsent(sessionId, k -> new CopyOnWriteArrayList<>()).add(emitter);

        emitter.onCompletion(() -> removeEmitter(sessionId, emitter));
        emitter.onTimeout(() -> removeEmitter(sessionId, emitter));
        emitter.onError(e -> removeEmitter(sessionId, emitter));
        return emitter;
    }

    private void removeEmitter(String sessionId, SseEmitter emitter) {
        List<SseEmitter> emitters = sessionEmitters.get(sessionId);
        if (emitters != null) {
            emitters.remove(emitter);
            if (emitters.isEmpty()) {
                sessionEmitters.remove(sessionId);
            }
        }
    }

    public void notifySessionClients(String sessionId, String message) {
        List<SseEmitter> emitters = sessionEmitters.get(sessionId);
        if (emitters == null) return;

        List<SseEmitter> deadEmitters = new CopyOnWriteArrayList<>();
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event().name("message").data(message));
            } catch (Exception e) {
                deadEmitters.add(emitter);
            }
        }
        emitters.removeAll(deadEmitters);
    }
    
}
