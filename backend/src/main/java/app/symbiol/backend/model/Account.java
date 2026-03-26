package app.symbiol.backend.model;

import java.time.Instant;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;

@Entity
public class Account {

    @Id
    @GeneratedValue(strategy=GenerationType.AUTO)
    private Long id;

    private Instant creationDate;
    private String username;
    private String hashedPassword;

    protected Account() {};

    public Account(String username, String hashedPassword) {
        this.creationDate = Instant.now();
        this.username = username;
        this.hashedPassword = hashedPassword;
    }

    public Long getId() { return this.id; }
    public String getUsername() { return this.username; }
    public String getHashedPassword() { return this.hashedPassword; }
    public Instant getCreationDate() { return this.creationDate; }
}