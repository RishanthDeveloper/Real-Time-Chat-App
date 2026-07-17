package com.chatapp.realtimechat.controller;

import com.chatapp.realtimechat.dto.PingDto;
import com.chatapp.realtimechat.dto.PongDto;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.annotation.SendToUser;
import org.springframework.stereotype.Controller;

import java.time.Instant;

/**
 * Backs the ConnectionMonitor's latency sparkline with a real measurement
 * instead of a simulated one. Client sends its own timestamp; echoing it
 * back lets the client compute round-trip time as
 * (Date.now() - pong.clientTimestamp) without needing clock sync between
 * browser and server.
 *
 * @SendToUser routes the reply to only the requesting session's private
 * /user/queue/pong destination — this rides the same user-destination
 * machinery StompPrincipal enables, so it works correctly regardless of
 * which backend instance the client is connected to.
 */
@Controller
public class PingController {

    @MessageMapping("/ping")
    @SendToUser("/queue/pong")
    public PongDto pong(@Payload PingDto ping) {
        return new PongDto(ping.clientTimestamp(), Instant.now().toEpochMilli());
    }
}
