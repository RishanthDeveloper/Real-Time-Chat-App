package com.chatapp.realtimechat.listener;

import com.chatapp.realtimechat.dto.PresenceEventDto;
import com.chatapp.realtimechat.redis.RedisMessagePublisher;
import org.springframework.context.event.EventListener;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.time.Duration;
import java.time.Instant;

/**
 * Tracks online/offline presence in Redis and broadcasts changes to every
 * instance via the shared "chat:presence" Redis channel.
 *
 * NOTE on event choice: SessionConnectEvent fires the moment the CONNECT
 * frame arrives, before the broker has finished the STOMP handshake and
 * before this app is guaranteed to have a CONNECTED ack out to the client.
 * SessionConnectedEvent fires right after that handshake completes
 * successfully, which is the point at which we know (a) auth succeeded,
 * because JwtChannelInterceptor already ran and would have thrown otherwise,
 * and (b) session attributes set in the interceptor are safely readable.
 * That's why this listener uses SessionConnectedEvent rather than
 * SessionConnectEvent for the "user came online" half.
 *
 * A TTL is set on the presence key (not just a plain SET) so that a server
 * crash/kill -9 that skips SessionDisconnectEvent doesn't leave a user
 * stuck "ONLINE" forever — the key self-expires and a heartbeat/refresh
 * mechanism (omitted here, same idea as the TTL) would renew it periodically
 * in a production system.
 */
@Component
public class PresenceEventListener {

    private static final String PRESENCE_KEY_PREFIX = "presence:user:";
    private static final Duration PRESENCE_TTL = Duration.ofMinutes(2);

    private final RedisTemplate<String, Object> redisTemplate;
    private final RedisMessagePublisher redisMessagePublisher;

    public PresenceEventListener(RedisTemplate<String, Object> redisTemplate,
                                  RedisMessagePublisher redisMessagePublisher) {
        this.redisTemplate = redisTemplate;
        this.redisMessagePublisher = redisMessagePublisher;
    }

    @EventListener
    public void handleSessionConnected(SessionConnectedEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String userId = readAttr(accessor, "userId");
        String username = readAttr(accessor, "username");

        if (userId == null) return;

        redisTemplate.opsForValue().set(PRESENCE_KEY_PREFIX + userId, "ONLINE", PRESENCE_TTL);

        redisMessagePublisher.publishPresenceEvent(
                new PresenceEventDto(userId, username, "ONLINE", Instant.now().toString())
        );
    }

    @EventListener
    public void handleSessionDisconnect(SessionDisconnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String userId = readAttr(accessor, "userId");
        String username = readAttr(accessor, "username");

        if (userId == null) return;

        redisTemplate.delete(PRESENCE_KEY_PREFIX + userId);

        redisMessagePublisher.publishPresenceEvent(
                new PresenceEventDto(userId, username, "OFFLINE", Instant.now().toString())
        );
    }

    private String readAttr(StompHeaderAccessor accessor, String key) {
        if (accessor.getSessionAttributes() == null) return null;
        Object val = accessor.getSessionAttributes().get(key);
        return val != null ? val.toString() : null;
    }
}
