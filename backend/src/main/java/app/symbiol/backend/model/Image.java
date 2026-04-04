package app.symbiol.backend.model;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;

@Entity
public class Image {

    
    @Id
    @GeneratedValue(strategy=GenerationType.AUTO)
    private Long id;

    private Instant uploadDate;

    @Column(nullable=false, length=255)
    private String fileName; // including extension

    @ManyToOne(optional = false)
    @JoinColumn(name = "session_id")
    private Session session;

    @PrePersist
    public void prePersist() {
        uploadDate = Instant.now();
    }

    protected Image() { 

    }

    public Image(Session session, String fileName) {
        this.session = session;
        this.fileName = fileName;
    }

    public Long getId() { 
        return id;
    }

    public String getFileName() { 
        return this.fileName;
    }

    public Instant getUploadDate() {
        return this.uploadDate;
    }

}
