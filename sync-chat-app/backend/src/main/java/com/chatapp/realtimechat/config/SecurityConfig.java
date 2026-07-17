package com.chatapp.realtimechat.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Standard stateless REST security (login/register/history endpoints use
 * ordinary JWT-in-Authorization-header auth via a normal OncePerRequestFilter,
 * omitted here as boilerplate).
 *
 * The important line for this project is permitAll() on /ws/**: the SockJS
 * HTTP handshake itself is intentionally left open at the servlet layer,
 * because real authentication for the WebSocket session happens one level up
 * in the STOMP CONNECT frame via JwtChannelInterceptor. Locking down /ws/**
 * here as well would block the SockJS handshake before a token even has a
 * chance to be read.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/ws/**", "/api/auth/**").permitAll()
                .anyRequest().authenticated()
            );
        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
