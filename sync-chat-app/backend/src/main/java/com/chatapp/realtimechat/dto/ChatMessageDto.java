package com.chatapp.realtimechat.dto;

public record ChatMessageDto(
        Long id,
        String roomId,
        String senderId,
        String senderUsername,
        String content,
        String timestamp,
        MessageType type
) {
    public enum MessageType { CHAT, TYPING, JOIN, LEAVE }
}
