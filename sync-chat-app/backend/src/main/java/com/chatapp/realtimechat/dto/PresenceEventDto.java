package com.chatapp.realtimechat.dto;

public record PresenceEventDto(
        String userId,
        String username,
        String status, // "ONLINE" | "OFFLINE"
        String timestamp
) {}
