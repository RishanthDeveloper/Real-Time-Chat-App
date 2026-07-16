package com.chatapp.realtimechat.config;

import com.chatapp.realtimechat.security.JwtChannelInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * Core STOMP/WebSocket wiring.
 *
 * IMPORTANT DESIGN DECISION: we do NOT use Spring's built-in
 * "stomp broker relay" (which would talk to a full STOMP-capable broker like
 * RabbitMQ). We keep enableSimpleBroker() — a broker local to each JVM — and
 * handle cross-instance fan-out ourselves via Redis Pub/Sub
 * (see RedisConfig / RedisMessagePublisher / RedisMessageSubscriber).
 *
 * This is intentional: Redis Pub/Sub is lighter to operate than a dedicated
 * STOMP broker, and it lets ChatController stay in full control of what gets
 * persisted vs. broadcast vs. queued for Kafka.
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final JwtChannelInterceptor jwtChannelInterceptor;

    public WebSocketConfig(JwtChannelInterceptor jwtChannelInterceptor) {
        this.jwtChannelInterceptor = jwtChannelInterceptor;
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*") // tighten to your actual frontend origin(s) in prod
                .withSockJS();
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic", "/queue");
        registry.setApplicationDestinationPrefixes("/app");
        registry.setUserDestinationPrefix("/user"); // enables convertAndSendToUser for DMs/notifications
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        // This is where JWT auth actually happens for WebSocket traffic —
        // NOT in a servlet Filter, because the browser's native WebSocket API
        // cannot attach custom Authorization headers to the handshake.
        // The token instead travels inside the STOMP CONNECT frame's native
        // headers, which this interceptor reads on the first frame of the session.
        registration.interceptors(jwtChannelInterceptor);
    }
}
