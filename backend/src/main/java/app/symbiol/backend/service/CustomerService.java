package app.symbiol.backend.service;

import org.springframework.data.domain.Example;
import org.springframework.stereotype.Service;

import app.symbiol.backend.model.Customer;
import app.symbiol.backend.repository.CustomerRepository;

@Service
public class CustomerService {
    public final CustomerRepository customerRepository;

    public CustomerService(CustomerRepository customerRepository) {
        this.customerRepository = customerRepository;
    }
       
    public void createCustomer(String firstName, String lastName) {
        customerRepository.save(new Customer(firstName, lastName));
    }

    public boolean customerExists(String firstName, String lastName) {
        Customer probe = new Customer(firstName, lastName);
        Example<Customer> example = Example.of(probe);
        return customerRepository.exists(example);
    }
}
