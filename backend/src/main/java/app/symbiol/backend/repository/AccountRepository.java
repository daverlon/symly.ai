package app.symbiol.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import app.symbiol.backend.model.Account;

@Repository
public interface AccountRepository extends JpaRepository<Account, Long> {
    
}
