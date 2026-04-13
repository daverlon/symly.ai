package app.symbiol.backend.model;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OneToOne;

@Entity
public class DeskImage {

    @Id
    @GeneratedValue(strategy=GenerationType.AUTO)
    private Long id;
    
    @OneToOne(optional = false)
    @JoinColumn(name = "session_id")
    private Session session;

    @ManyToOne()
    @JoinColumn(name = "image_id")
    private Image image;

    int position; // left->right starting from 0

    protected DeskImage() {
    }

    public DeskImage(Session session, Image image, int position) {
        this.session = session;
        this.image = image;
        this.position = position;
    }

    public Image getImage() {
        return this.image;
    }

    public String getFileName() {
        return this.image.getFileName();
    }

}
