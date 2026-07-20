package com.chatapp.realtimechat.controller;

import com.chatapp.realtimechat.security.JwtService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final JwtService jwtService;

    public AuthController(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    public record LoginRequest(String username, String password) {}
    public record AuthResponse(String token, String userId, String username) {}

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@RequestBody LoginRequest request) {
        String username = (request.username() == null || request.username().isBlank()) ? "User_" + UUID.randomUUID().toString().substring(0, 4) : request.username();
        String userId = "user-" + Math.abs(username.hashCode());
        String token = jwtService.generateToken(userId, username);

        return ResponseEntity.ok(new AuthResponse(token, userId, username));
    }

    @GetMapping("/demo-token")
    public ResponseEntity<AuthResponse> getDemoToken(@RequestParam(defaultValue = "Guest") String username) {
        String userId = "user-" + Math.abs(username.hashCode());
        String token = jwtService.generateToken(userId, username);

        return ResponseEntity.ok(new AuthResponse(token, userId, username));
    }
}
