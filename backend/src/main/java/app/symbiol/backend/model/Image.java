package app.symbiol.backend.model;

import java.time.Instant;
import java.util.List;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.PrePersist;

@Entity
public class Image {

    
    @Id
    @GeneratedValue(strategy=GenerationType.AUTO)
    private Long id;

    private Instant uploadDate;

    @Column(nullable=false, length=255)
    private String fileName; // including extension

    @Column(columnDefinition = "TEXT")
    private String ocrText; // cached Mathpix flat text result

    @Column(columnDefinition = "TEXT")
    private String ocrLineData; // cached Mathpix line_data JSON (spatial layout)

    @Column(columnDefinition = "TEXT")
    private String ocrWordData; // cached Mathpix word_data JSON (word-level bounding boxes)

    @ManyToOne(optional = false)
    @JoinColumn(name = "session_id")
    private Session session;

    @PrePersist
    public void prePersist() {
        uploadDate = Instant.now();
    }

    @OneToMany(mappedBy = "image")
    private List<DeskImage> deskImages;


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

    public String getOcrText() {
        return ocrText;
    }

    public void setOcrText(String ocrText) {
        this.ocrText = ocrText;
    }

    public String getOcrLineData() {
        return ocrLineData;
    }

    public void setOcrLineData(String ocrLineData) {
        this.ocrLineData = ocrLineData;
    }

    public String getOcrWordData() {
        return ocrWordData;
    }

    public void setOcrWordData(String ocrWordData) {
        this.ocrWordData = ocrWordData;
    }

}
