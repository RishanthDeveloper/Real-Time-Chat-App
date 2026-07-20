package com.chatapp.realtimechat.service;

import com.chatapp.realtimechat.dto.ChatMessageDto;
import com.chatapp.realtimechat.entity.ChatMessageEntity;
import com.chatapp.realtimechat.repository.ChatMessageRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class ChatMessageServiceImpl implements ChatMessageService {

    private final ChatMessageRepository repository;

    public ChatMessageServiceImpl(ChatMessageRepository repository) {
        this.repository = repository;
    }

    @Override
    @Transactional
    public ChatMessageDto persist(String roomId, String senderId, String content) {
        Instant now = Instant.now();
        ChatMessageEntity entity = new ChatMessageEntity(roomId, senderId, content, now);
        ChatMessageEntity saved = repository.save(entity);

        return new ChatMessageDto(
                saved.getId(),
                saved.getRoomId(),
                saved.getSenderId(),
                saved.getSenderId(), // Username fallback to senderId if not resolved
                saved.getContent(),
                saved.getCreatedAt().toString(),
                ChatMessageDto.MessageType.CHAT
        );
    }

    @Transactional(readOnly = true)
    public List<ChatMessageDto> getRoomHistory(String roomId) {
        return repository.findByRoomIdOrderByCreatedAtAsc(roomId).stream()
                .map(msg -> new ChatMessageDto(
                        msg.getId(),
                        msg.getRoomId(),
                        msg.getSenderId(),
                        msg.getSenderId(),
                        msg.getContent(),
                        msg.getCreatedAt().toString(),
                        ChatMessageDto.MessageType.CHAT
                ))
                .collect(Collectors.toList());
    }
}
