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

    private String firstName;
    private String lastName;
    private Date creationDate;

    protected Account() {};

    public Account(String firstName, String lastName) {
        this.firstName = firstName;
        this.lastName = lastName;
        this.creationDate = new Date(System.currentTimeMillis());
    }

    @Override
    public String toString() {
        return String.format("account[id=%d, firstName=%s, lastName=%s]");
    }

    public Long getId() { return this.id; }
    public String getFirstName() { return this.firstName; }
    public String getLastName() { return this.lastName; }
    public Date getCreationDate() { return this.creationDate; }
}