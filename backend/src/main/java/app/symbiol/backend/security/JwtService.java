package app.symbiol.backend.security;

import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Map;

import javax.crypto.SecretKey;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

@Service
public class JwtService {

    private final SecretKey key;
    private final long expirationMillis;

    private static final long UPLOAD_SESSION_EXPIRATION_MILLIS = 15 * 60 * 1000; // 15 minutes
    private static final String UPLOAD_SESSION_SCOPE = "uploadSession";
    
    public JwtService(
        @Value("${jwt.secret}") String secret,
        @Value("${jwt.expiration}") long expirationMillis
    ) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationMillis = expirationMillis;
    }

    public String generateToken(String username) {
        return Jwts.builder()
            .subject(username)
            .issuedAt(new Date())
            .expiration(new Date(System.currentTimeMillis() + expirationMillis))
            .signWith(key)
            .compact();
    }

    public String validateTokenAndGetUsername(String token) throws JwtException {
        Claims claims = Jwts.parser()
            .verifyWith(key)
            .build()
            .parseSignedClaims(token)
            .getPayload();
        if (claims.getExpiration().before(new Date())) {
            throw new JwtException("Token expired");
        }
        return claims.getSubject();
    }

    public String generateUploadSessionToken(Long sessionId) {
        return Jwts.builder()
            .subject(sessionId.toString())
            .claims(Map.of("scope", UPLOAD_SESSION_SCOPE))
            .issuedAt(new Date())
            .expiration(new Date(System.currentTimeMillis() + UPLOAD_SESSION_EXPIRATION_MILLIS))
            .signWith(key)
            .compact();
    }

    public Long validateUploadSessionTokenAndGetSessionId(String token) throws JwtException {
        Claims claims = Jwts.parser()
            .verifyWith(key)
            .build()
            .parseSignedClaims(token)
            .getPayload();

        if (claims.getExpiration() != null && claims.getExpiration().before(new Date())) {
            throw new JwtException("Upload session token expired");
        }

        Object scope = claims.get("scope");
        if (!(scope instanceof String) || !UPLOAD_SESSION_SCOPE.equals(scope)) {
            throw new JwtException("Invalid upload session scope");
        }

        return Long.parseLong(claims.getSubject());
    }
}
