package com.chatapp.realtimechat.redis;

import com.chatapp.realtimechat.config.RedisConfig;
import com.chatapp.realtimechat.dto.ChatMessageDto;
import com.chatapp.realtimechat.dto.PresenceEventDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

/**
 * THIS is the class that actually achieves multi-instance fan-out.
 *
 * Every backend instance runs its own copy of this listener (registered via
 * RedisConfig's RedisMessageListenerContainer). Redis itself guarantees that
 * a PUBLISH on a channel reaches every SUBSCRIBEd process — including the
 * instance that published it. When onMessage() fires here, it uses
 * SimpMessagingTemplate to push only to WebSocket sessions connected to THIS
 * JVM. Multiply that across N instances and every connected client, on any
 * instance, receives the message.
 */
@Component
public class RedisMessageSubscriber implements MessageListener {

    private final SimpMessagingTemplate messagingTemplate;
    private final ObjectMapper objectMapper;

    public RedisMessageSubscriber(SimpMessagingTemplate messagingTemplate, ObjectMapper objectMapper) {
        this.messagingTemplate = messagingTemplate;
        this.objectMapper = objectMapper;
    }

    @Override
    public void onMessage(Message message, byte[] pattern) {
        String channel = new String(message.getChannel());
        String body = new String(message.getBody());

        try {
            if (channel.startsWith(RedisConfig.CHAT_CHANNEL_PREFIX)) {
                String roomId = channel.substring(RedisConfig.CHAT_CHANNEL_PREFIX.length());
                ChatMessageDto dto = objectMapper.readValue(body, ChatMessageDto.class);

                // Split by message type onto distinct topics rather than overloading
                // one channel with mixed shapes — lets the frontend subscribe to
                // "/topic/room.{id}.messages" and "/topic/room.{id}.typing"
                // independently and handle each with dedicated, simple logic.
                String suffix = dto.type() == ChatMessageDto.MessageType.TYPING ? "typing" : "messages";
                messagingTemplate.convertAndSend("/topic/room." + roomId + "." + suffix, dto);

            } else if (channel.equals(RedisConfig.PRESENCE_CHANNEL)) {
                PresenceEventDto dto = objectMapper.readValue(body, PresenceEventDto.class);
                messagingTemplate.convertAndSend("/topic/presence", dto);
            }
        } catch (Exception e) {
            // A malformed payload must never kill the listener container's thread —
            // that would silently stop delivery for every room on this instance.
            System.err.println("Failed to process Redis message on channel " + channel + ": " + e.getMessage());
        }
    }
}
