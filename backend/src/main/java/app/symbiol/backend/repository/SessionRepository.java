package app.symbiol.backend.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import app.symbiol.backend.model.Account;
import app.symbiol.backend.model.Session;

@Repository
public interface SessionRepository extends JpaRepository<Session, Long> {
    List<Session> findByAccount(Account account);

    Optional<Session> findByIdAndAccount(Long id, Account account);
}

