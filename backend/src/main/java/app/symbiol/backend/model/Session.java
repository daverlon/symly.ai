package app.symbiol.backend.model;

import java.sql.Date;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;

@Entity
public class Session {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private Long id;

    private Date creationDate;

    @ManyToOne(optional = false)
    @JoinColumn(name = "account_id")
    private Account account;

    protected Session() {
    }

    public Session(Account account) {
        this.creationDate = new Date(System.currentTimeMillis());
        this.account = account;
    }

    public Long getId() {
        return id;
    }

    public Date getCreationDate() {
        return creationDate;
    }
}

