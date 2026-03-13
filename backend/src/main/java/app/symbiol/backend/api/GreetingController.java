package app.symbiol.backend.api;

import java.util.concurrent.atomic.AtomicLong;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import app.symbiol.backend.model.Greeting;

@RestController
@RequestMapping("/")
public class GreetingController {

    private static final String template = "Hello, %s!";
    private final AtomicLong counter = new AtomicLong();
    
    @GetMapping("/greeting")
    public Greeting greeting(@RequestParam(name = "name", defaultValue = "World") String content) {
        return new Greeting(counter.incrementAndGet(), template.formatted(content));
    }
}
