package com.chatapp.realtimechat.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;

/**
 * Thin wrapper around jjwt (io.jsonwebtoken). Kept deliberately minimal —
 * token issuance (login endpoint) is a separate, ordinary REST concern and
 * isn't included here since it's not unique to the WebSocket/Redis story.
 */
@Service
public class JwtService {

    private final SecretKey signingKey;

    public JwtService(@Value("${app.jwt.secret}") String secret) {
        this.signingKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    /** Throws JwtException (expired, malformed, bad signature) if invalid. */
    public Claims validateAndParse(String token) {
        return Jwts.parser()
                .verifyWith(signingKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public String generateToken(String userId, String username) {
        long now = System.currentTimeMillis();
        return Jwts.builder()
                .subject(userId)
                .claim("username", username)
                .issuedAt(new java.util.Date(now))
                .expiration(new java.util.Date(now + 86400000))
                .signWith(signingKey)
                .compact();
    }
}
