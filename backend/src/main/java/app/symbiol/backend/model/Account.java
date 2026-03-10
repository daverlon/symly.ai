package app.symbiol.backend.model;

import java.sql.Date;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;

@Entity
public class Account {

    @Id
    @GeneratedValue(strategy=GenerationType.AUTO)
    private Long id;

    private Date creationDate;
    private String username;
    private String hashedPassword;

    protected Account() {};

    public Account(String firstName, String hashedPassword) {
        this.creationDate = new Date(System.currentTimeMillis());
        this.username = firstName;
        this.hashedPassword = hashedPassword;
    }

    public Long getId() { return this.id; }
    public String getUsername() { return this.username; }
    public String getHashedPassword() { return this.hashedPassword; }
    public Date getCreationDate() { return this.creationDate; }
}