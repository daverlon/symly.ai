package app.symbiol.backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import app.symbiol.backend.security.JwtAuthenticationFilter;
import app.symbiol.backend.security.JwtService;

@Configuration
@EnableWebSecurity
public class WebSecurityConfig {

    JwtService jwtService;

    public WebSecurityConfig(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {

        JwtAuthenticationFilter jwtFilter = new JwtAuthenticationFilter(jwtService);

        http
            .cors(cors -> {})
            .csrf(csrf -> csrf.disable())
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/auth/**", "/accounts").permitAll() // login/register
                .requestMatchers("/u/**").permitAll()                 // public upload route



                /*
                        INSECURE IMPLEMENTATION OF SSE STREAM
                        TODO: HTTPONLY COOKIE OR TEMPORARY TOKEN EXCHANGE 
                */
                .requestMatchers("/stream/**").permitAll()                 // public upload route



                .anyRequest().authenticated()                         // everything else requires JWT
            )
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
            ;

        return http.build();
    }

    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/**")
                .allowedOriginPatterns("http://localhost:5173")
                .allowedMethods("*")
                .allowedHeaders("*");
            }
        };
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
