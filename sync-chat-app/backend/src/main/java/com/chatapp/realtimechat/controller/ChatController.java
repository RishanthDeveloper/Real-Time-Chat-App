package com.chatapp.realtimechat.controller;

import com.chatapp.realtimechat.dto.ChatMessageDto;
import com.chatapp.realtimechat.kafka.AnalyticsEventProducer;
import com.chatapp.realtimechat.redis.RedisMessagePublisher;
import com.chatapp.realtimechat.security.StompPrincipal;
import com.chatapp.realtimechat.service.ChatMessageService;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.time.Instant;

/**
 * Handles inbound STOMP messages sent to /app/**.
 *
 * Flow for a real message (see README for the full cross-instance diagram):
 *   1. Client publishes to /app/chat.sendMessage/{roomId}
 *   2. This method persists it (source of truth = Postgres)
 *   3. This method publishes the persisted message to Redis
 *   4. Every instance's RedisMessageSubscriber (including this one) picks it
 *      up and pushes it to its own locally-connected clients via
 *      SimpMessagingTemplate.
 *
 * Note this controller never calls SimpMessagingTemplate.convertAndSend()
 * itself — broadcasting is entirely the subscriber's job. That separation is
 * what makes the system horizontally scalable: this method doesn't need to
 * know or care which instance the recipient is connected to.
 */
@Controller
public class ChatController {

    private final RedisMessagePublisher redisMessagePublisher;
    private final ChatMessageService chatMessageService;
    private final AnalyticsEventProducer analyticsEventProducer;

    public ChatController(RedisMessagePublisher redisMessagePublisher,
                           ChatMessageService chatMessageService,
                           AnalyticsEventProducer analyticsEventProducer) {
        this.redisMessagePublisher = redisMessagePublisher;
        this.chatMessageService = chatMessageService;
        this.analyticsEventProducer = analyticsEventProducer;
    }

    @MessageMapping("/chat.sendMessage/{roomId}")
    public void sendMessage(@DestinationVariable String roomId,
                             ChatMessageDto incoming,
                             Principal principal) {

        StompPrincipal user = (StompPrincipal) principal;

        ChatMessageDto persisted = chatMessageService.persist(roomId, user.userId(), incoming.content());

        ChatMessageDto outgoing = new ChatMessageDto(
                persisted.id(),
                roomId,
                user.userId(),
                user.username(),
                incoming.content(),
                Instant.now().toString(),
                ChatMessageDto.MessageType.CHAT
        );

        // Real-time path: fan out to every connected client across every instance.
        redisMessagePublisher.publishChatMessage(roomId, outgoing);

        // Side-channel path: fire-and-forget onto Kafka for anything that
        // doesn't need to happen in the hot request path (see AnalyticsEventProducer
        // for why this is on Kafka and not just another Redis publish).
        analyticsEventProducer.publishMessageSent(outgoing);
    }

    @MessageMapping("/chat.typing/{roomId}")
    public void typing(@DestinationVariable String roomId, Principal principal) {
        StompPrincipal user = (StompPrincipal) principal;

        ChatMessageDto typingEvent = new ChatMessageDto(
                null, roomId, user.userId(), user.username(),
                null, Instant.now().toString(), ChatMessageDto.MessageType.TYPING
        );

        // Typing indicators are ephemeral — publish straight to Redis, never persisted, never sent to Kafka.
        redisMessagePublisher.publishChatMessage(roomId, typingEvent);
    }
}
