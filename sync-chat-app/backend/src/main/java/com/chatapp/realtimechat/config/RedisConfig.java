package com.chatapp.realtimechat.config;

import com.chatapp.realtimechat.redis.RedisMessageSubscriber;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.PatternTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.data.redis.serializer.StringRedisSerializer;

@Configuration
public class RedisConfig {

    // Every chat room gets its own channel: chat:room:<roomId>
    public static final String CHAT_CHANNEL_PREFIX = "chat:room:";
    // A single shared channel for presence (online/offline) events
    public static final String PRESENCE_CHANNEL = "chat:presence";

    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory factory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(factory);
        template.setKeySerializer(new StringRedisSerializer());
        template.setValueSerializer(new StringRedisSerializer());
        template.setHashKeySerializer(new StringRedisSerializer());
        template.setHashValueSerializer(new StringRedisSerializer());
        return template;
    }

    @Bean
    public ChannelTopic presenceTopic() {
        return new ChannelTopic(PRESENCE_CHANNEL);
    }

    /**
     * Every instance runs this listener container. Because we subscribe with
     * a PATTERN ("chat:room:*") rather than individual channels, a new room
     * created at runtime is picked up automatically — no restart, no registry
     * of "known rooms" to maintain.
     */
    @Bean
    public RedisMessageListenerContainer redisMessageListenerContainer(
            RedisConnectionFactory factory,
            RedisMessageSubscriber subscriber,
            ChannelTopic presenceTopic) {

        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(factory);
        container.addMessageListener(subscriber, new PatternTopic(CHAT_CHANNEL_PREFIX + "*"));
        container.addMessageListener(subscriber, presenceTopic);
        return container;
    }
}
