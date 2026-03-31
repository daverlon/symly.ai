package app.symbiol.backend.model;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;

@Entity
public class Session {
    
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private Long id;

    @Column(nullable = false, unique = true, updatable = false)
    private String publicId;

    private Instant creationDate;
    private static String generatePublicId() {
        return UUID.randomUUID().toString();
    }

    @ManyToOne(optional = false)
    @JoinColumn(name = "account_id")
    private Account account;

    @OneToMany(mappedBy = "session")
    private List<Image> images;

    protected Session() {
    }

    public Session(Account account) {
        this.creationDate = Instant.now();
        this.publicId = generatePublicId();
        this.account = account;
    }

    public Long getId() {
        return id;
    }

    public String getPublicId() {
        return publicId;
    }

    public Instant getCreationDate() {
        return creationDate;
    }
}

