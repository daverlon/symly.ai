package app.symbiol.backend.model;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;

@Entity
public class UploadSessionKey {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private Long id;

    @Column(nullable = false, unique = true)
    private String key;

    @ManyToOne(optional = false)
    @JoinColumn(name = "session_id")
    private Session session;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant expiresAt;

    protected UploadSessionKey() {
    }

    public UploadSessionKey(Session session, String key, Instant expiresAt) {
        this.session = session;
        this.key = key;
        this.createdAt = Instant.now();
        this.expiresAt = expiresAt;
    }

    public Long getId() {
        return this.id;
    }

    public Session getSession() {
        return this.session;
    }

    public String getKey() {
        return this.key;
    }

    public Instant getCreatedAt() {
        return this.createdAt;
    }

    public Instant getExpiresAt() {
        return this.expiresAt;
    }
    
    public boolean isExpired() {
        return Instant.now().isAfter(expiresAt);
    }
}
