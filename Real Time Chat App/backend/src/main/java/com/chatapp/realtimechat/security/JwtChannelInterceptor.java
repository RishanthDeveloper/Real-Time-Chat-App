package com.chatapp.realtimechat.security;

import io.jsonwebtoken.Claims;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

import java.security.Principal;
import java.util.List;

/**
 * Authenticates WebSocket sessions at the STOMP protocol level.
 *
 * WHY NOT A SERVLET FILTER: The browser's WebSocket / SockJS handshake is
 * issued by the browser's own networking stack, which does not let JS attach
 * arbitrary headers (like "Authorization: Bearer ..."). By the time a normal
 * Spring Security filter chain would run, there's no reliable place to read
 * a bearer token from.
 *
 * Instead, the STOMP protocol itself carries "native headers" inside the
 * CONNECT frame payload — these are just part of the message body as far as
 * the HTTP handshake is concerned, so the client CAN set them freely
 * (see the frontend useChatWebSocket hook's connectHeaders). This
 * interceptor is the one and only place that inspects the CONNECT frame,
 * validates the JWT, and stamps a Principal onto the session — every
 * message on this session from then on is already authenticated.
 */
@Component
public class JwtChannelInterceptor implements ChannelInterceptor {

    private final JwtService jwtService;

    public JwtChannelInterceptor(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor =
                MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

        if (accessor == null) {
            return message;
        }

        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            String token = extractToken(accessor.getNativeHeader("Authorization"));

            if (token == null) {
                // Throwing here rejects the CONNECT frame outright — the client's
                // onStompError callback fires and the connection is torn down.
                throw new IllegalArgumentException("Missing Authorization header in STOMP CONNECT frame");
            }

            Claims claims = jwtService.validateAndParse(token); // throws on invalid/expired token
            String userId = claims.getSubject();
            String username = claims.get("username", String.class);

            Principal principal = new StompPrincipal(userId, username);
            accessor.setUser(principal);

            // Session attributes survive for the lifetime of the WS session,
            // so PresenceEventListener can read them later without re-parsing
            // the JWT on every connect/disconnect event.
            if (accessor.getSessionAttributes() != null) {
                accessor.getSessionAttributes().put("userId", userId);
                accessor.getSessionAttributes().put("username", username);
            }
        }

        return message;
    }

    private String extractToken(List<String> authHeaders) {
        if (authHeaders == null || authHeaders.isEmpty()) {
            return null;
        }
        String raw = authHeaders.get(0);
        return raw.startsWith("Bearer ") ? raw.substring(7) : raw;
    }
}
