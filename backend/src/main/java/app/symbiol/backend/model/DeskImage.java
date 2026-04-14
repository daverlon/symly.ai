package app.symbiol.backend.model;

import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;

@Entity
public class DeskImage {

    @Id
    @GeneratedValue(strategy=GenerationType.AUTO)
    private Long id;
    
    @ManyToOne(optional = false)
    @JoinColumn(name = "session_id")
    private Session session;

    @ManyToOne()
    @JoinColumn(name = "image_id")
    private Image image;

    // force unique?
    @Column(nullable = false, length=255)
    private String uid;

    int position; // left->right starting from 0

    protected DeskImage() {
    }

    public DeskImage(Session session, Image image, int position) {
        this.session = session;
        this.image = image;
        this.position = position;
        this.uid = UUID.randomUUID().toString();
    }

    public Image getImage() {
        return this.image;
    }

    public String getFileName() {
        return this.image.getFileName();
    }

    public String getUid() { return this.uid; }

}
