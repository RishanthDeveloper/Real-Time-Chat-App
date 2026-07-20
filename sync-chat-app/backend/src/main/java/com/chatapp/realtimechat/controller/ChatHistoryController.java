package com.chatapp.realtimechat.controller;

import com.chatapp.realtimechat.dto.ChatMessageDto;
import com.chatapp.realtimechat.service.ChatMessageServiceImpl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/rooms")
public class ChatHistoryController {

    private final ChatMessageServiceImpl chatMessageService;

    public ChatHistoryController(ChatMessageServiceImpl chatMessageService) {
        this.chatMessageService = chatMessageService;
    }

    @GetMapping("/{roomId}/messages")
    public ResponseEntity<List<ChatMessageDto>> getRoomHistory(@PathVariable String roomId) {
        List<ChatMessageDto> history = chatMessageService.getRoomHistory(roomId);
        return ResponseEntity.ok(history);
    }
}
