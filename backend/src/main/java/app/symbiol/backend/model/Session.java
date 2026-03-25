package app.symbiol.backend.model;

import java.sql.Date;
import java.util.Base64;
import java.util.Random;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;

@Entity
public class Session {

    private final Random random = new Random();

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private Long id;

    @Column(nullable = false, unique = true)
    private String publicId;

    private Date creationDate;
    private String generatePublicId() {
        byte[] bytes = new byte[16];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    @ManyToOne(optional = false)
    @JoinColumn(name = "account_id")
    private Account account;

    protected Session() {
    }

    public Session(Account account) {
        this.creationDate = new Date(System.currentTimeMillis());
        this.publicId = generatePublicId();
        this.account = account;
    }

    public Long getId() {
        return id;
    }

    public String getPublicId() {
        return publicId;
    }

    public Date getCreationDate() {
        return creationDate;
    }
}

