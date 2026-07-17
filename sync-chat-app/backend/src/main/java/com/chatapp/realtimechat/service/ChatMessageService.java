package com.chatapp.realtimechat.service;

import com.chatapp.realtimechat.dto.ChatMessageDto;

/**
 * Deliberately just an interface here. The implementation is a standard
 * Spring Data JPA save-and-map operation against a ChatMessage entity /
 * ChatMessageRepository — ordinary CRUD that isn't unique to the WebSocket
 * or Redis architecture, so it's left out per project scope. Wire up your
 * own JPA entity + repository and implement persist() to save and return it.
 */
public interface ChatMessageService {
    ChatMessageDto persist(String roomId, String senderId, String content);
}
