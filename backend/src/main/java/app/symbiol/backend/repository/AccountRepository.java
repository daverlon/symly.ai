package app.symbiol.backend.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import app.symbiol.backend.model.Account;

@Repository
public interface AccountRepository extends JpaRepository<Account, Long> {

    boolean existsByUsername(String username);
    boolean existsByUsernameAndHashedPassword(String username, String hashedPassword);

    Optional<Account> findByUsername(String username);
}
