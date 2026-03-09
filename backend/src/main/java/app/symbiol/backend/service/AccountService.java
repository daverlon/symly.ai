package app.symbiol.backend.service;

import org.springframework.data.domain.Example;
import org.springframework.stereotype.Service;

import app.symbiol.backend.model.Account;
import app.symbiol.backend.repository.AccountRepository;

@Service
public class AccountService {
    public final AccountRepository accountRepository;

    public AccountService(AccountRepository accountRepository) {
        this.accountRepository = accountRepository;
    }
       
    public void createaccount(String firstName, String lastName) {
        accountRepository.save(new Account(firstName, lastName));
    }

    public boolean accountExists(String firstName, String lastName) {
        Account probe = new Account(firstName, lastName);
        Example<Account> example = Example.of(probe);
        return accountRepository.exists(example);
    }
}
