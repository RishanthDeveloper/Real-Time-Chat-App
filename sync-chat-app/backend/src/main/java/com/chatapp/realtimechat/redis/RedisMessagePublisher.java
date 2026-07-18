package com.chatapp.realtimechat.redis;

import com.chatapp.realtimechat.config.RedisConfig;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

/**
 * The ONLY place that pushes data into Redis Pub/Sub. Note this class never
 * touches SimpMessagingTemplate directly — it has no idea which clients are
 * connected to which instance, and that's the point. Publishing and
 * broadcasting are fully decoupled.
 */
@Component
public class RedisMessagePublisher {

    private final RedisTemplate<String, Object> redisTemplate;
    private final ObjectMapper objectMapper;

    public RedisMessagePublisher(RedisTemplate<String, Object> redisTemplate, ObjectMapper objectMapper) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
    }

    public void publishChatMessage(String roomId, Object payload) {
        publish(RedisConfig.CHAT_CHANNEL_PREFIX + roomId, payload);
    }

    public void publishPresenceEvent(Object payload) {
        publish(RedisConfig.PRESENCE_CHANNEL, payload);
    }

    private void publish(String channel, Object payload) {
        try {
            String json = objectMapper.writeValueAsString(payload);
            redisTemplate.convertAndSend(channel, json);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to publish to Redis channel " + channel, e);
        }
    }
}
