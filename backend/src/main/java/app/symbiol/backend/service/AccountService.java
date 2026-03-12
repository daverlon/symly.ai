package app.symbiol.backend.service;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import app.symbiol.backend.exception.AccountAlreadyExistsException;
import app.symbiol.backend.exception.IncorrectPasswordException;
import app.symbiol.backend.model.Account;
import app.symbiol.backend.repository.AccountRepository;

@Service
public class AccountService {
    public final AccountRepository accountRepository;

    private final PasswordEncoder passwordEncoder;

    private final String dummyHash;

    public AccountService(AccountRepository accountRepository, PasswordEncoder passwordEncoder) {
        this.accountRepository = accountRepository;
        this.passwordEncoder = passwordEncoder;

        this.dummyHash = passwordEncoder.encode("DUMMYPASSWORDTOCREATEANARTIFICIALDELAYONACCOUNTVALIDATION");
    }
       
    public void createAccount(String username, String password) {
        if (accountRepository.existsByUsername(username)) {
            throw new AccountAlreadyExistsException(username);
        }
        String hashedPassword = passwordEncoder.encode(password);

        accountRepository.save(new Account(username, hashedPassword));
    }

    public void validateAccount(String username, String password) {
        Account account = accountRepository.findByUsername(username).orElseThrow(() -> {
            passwordEncoder.matches(password, dummyHash);
            return new IncorrectPasswordException();
        });

        if (!passwordEncoder.matches(password, account.getHashedPassword())) {
            throw new IncorrectPasswordException();
        }
    }

    public boolean accountExistsByUsername(String username) {
        return accountRepository.existsByUsername(username);
    }
}
