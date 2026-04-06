package app.symbiol.backend.service;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

import jakarta.annotation.PreDestroy;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.fasterxml.jackson.databind.ObjectMapper;

import app.symbiol.backend.dto.NotificationMesageType;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
public class NotificationService {

    private static final long SSE_TIMEOUT_MS = /*60_000L*/0L;

    public NotificationService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    private final Map<String, List<SseEmitter>> sessionEmitters = new ConcurrentHashMap<>();

    private ObjectMapper objectMapper;

    public SseEmitter registerClient(String sessionId) {
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MS);
        sessionEmitters.computeIfAbsent(sessionId, k -> new CopyOnWriteArrayList<>()).add(emitter);

        emitter.onCompletion(() -> removeEmitter(sessionId, emitter));
        emitter.onTimeout(() -> {
            emitter.complete();
            removeEmitter(sessionId, emitter);
        });
        emitter.onError(e -> removeEmitter(sessionId, emitter));

        notifySessionClients(sessionId, NotificationMesageType.CONNECTED, sessionId);
        return emitter;
    }

    @PreDestroy
    public void closeAllEmitters() {
        sessionEmitters.values().forEach(list -> list.forEach(SseEmitter::complete));
        sessionEmitters.clear();
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

    private void notifySessionClients(String sessionId, String message) {
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

    // {
    //    "type": "event_type",
    //    "payload": { data },
    //    "timestamp": "YYY-MM-DDT23:00:00Z"
    // }

    public void notifySessionClients(String sessionId, NotificationMesageType type, Object payload) {
        try {
            String json = objectMapper.writeValueAsString(Map.of(
                    "type", type.getType(),
                    "payload", payload,
                    "timestamp", Instant.now().toString()));
            log.info("Notify session: " + sessionId + " payload: " + payload.toString());
            notifySessionClients(sessionId, json);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
    
}
