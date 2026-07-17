package com.chatapp.realtimechat.kafka;

import com.chatapp.realtimechat.dto.ChatMessageDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

/**
 * WHY KAFKA HERE, AND NOT JUST REDIS AGAIN: Redis Pub/Sub is fire-and-forget
 * with no persistence or replay — perfect for the live chat fan-out, where a
 * message that arrives 200ms from now is useless anyway. Kafka is used
 * specifically for the *downstream, non-real-time* consumers that need
 * durability and independent consumer groups:
 *
 *   - "chat-analytics"   -> a consumer aggregating message volume, active
 *                            rooms, DAU, etc. into a reporting store
 *   - "chat-search-index" -> a consumer pushing messages into Elasticsearch/
 *                            OpenSearch for full-text search
 *   - "chat-archival"    -> a consumer batching old messages into cold
 *                            storage / a data warehouse
 *
 * All three can be scaled, restarted, or fail independently of the live chat
 * path — if the analytics consumer is down for an hour, chat itself is
 * completely unaffected and Kafka just holds the backlog until it's back.
 * That decoupling is the whole justification for adding Kafka to this stack;
 * without a genuinely async, replayable, multi-consumer use case, Kafka
 * would just be unjustified operational overhead on top of Redis.
 */
@Component
public class AnalyticsEventProducer {

    private static final String TOPIC = "chat-message-events";

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    public AnalyticsEventProducer(KafkaTemplate<String, String> kafkaTemplate, ObjectMapper objectMapper) {
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = objectMapper;
    }

    public void publishMessageSent(ChatMessageDto message) {
        try {
            String json = objectMapper.writeValueAsString(message);
            // Key by roomId so Kafka preserves per-room ordering across partitions.
            kafkaTemplate.send(TOPIC, message.roomId(), json);
        } catch (Exception e) {
            // Analytics/indexing is best-effort by design — never let a Kafka
            // hiccup break message delivery, which has already succeeded via Redis.
            System.err.println("Failed to publish analytics event: " + e.getMessage());
        }
    }
}
