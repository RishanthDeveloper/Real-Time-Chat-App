package com.chatapp.realtimechat.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

/**
 * Stamps an "instance-id" header onto the STOMP CONNECTED frame sent back to
 * the client. This is purely observability — it lets the frontend's
 * ConnectionMonitor show which backend instance a session actually landed
 * on, which is the easiest way to *prove* during a demo that nginx is
 * load-balancing across app-instance-1 / app-instance-2 rather than pinning
 * everyone to one node.
 *
 * Sourced from the INSTANCE_ID env var (set per-container in docker-compose);
 * falls back to hostname, which inside Docker is the container ID/name.
 */
@Component
public class InstanceIdOutboundInterceptor implements ChannelInterceptor {

    private final String instanceId;

    public InstanceIdOutboundInterceptor(@Value("${app.instance-id:${HOSTNAME:unknown}}") String instanceId) {
        this.instanceId = instanceId;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor != null && StompCommand.CONNECTED.equals(accessor.getCommand())) {
            accessor.addNativeHeader("instance-id", instanceId);
        }
        return message;
    }
}
