package app.symbiol.backend.api;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import app.symbiol.backend.service.CustomerService;

@CrossOrigin(origins = "http://localhost:5173")
@RestController
@RequestMapping("/api")
public class CustomerController {

    public final CustomerService customerService;

    public CustomerController(CustomerService customerService) {
        this.customerService = customerService;
    }

    public static final String nameTemplate = "%s-%s";
        
    @GetMapping("/createCustomer")
    public String customerControllerResponse(
        @RequestParam(name = "firstName", defaultValue = "") String firstName,
        @RequestParam(name = "lastName", defaultValue = "") String lastName
    ) {
        if (firstName.isEmpty() || lastName.isEmpty()) {
            return "Bad name :(";
        }

        if (customerService.customerExists(firstName, lastName)) {
            return "Customer exists " + nameTemplate.formatted(firstName, lastName) + " :)";
        } 
        customerService.createCustomer(firstName, lastName);
        String responseText = "Created customer " + nameTemplate.formatted(firstName, lastName);
        return responseText;
    }
}
