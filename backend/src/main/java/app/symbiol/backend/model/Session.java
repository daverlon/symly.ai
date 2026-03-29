package app.symbiol.backend.model;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.List;

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

    private static final SecureRandom random = new SecureRandom();
    
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private Long id;

    @Column(nullable = false, unique = true, updatable = false)
    private String publicId;

    private Instant creationDate;
    private static String generatePublicId() {
        byte[] bytes = new byte[16];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
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

