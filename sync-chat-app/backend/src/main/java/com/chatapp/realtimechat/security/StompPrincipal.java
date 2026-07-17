package com.chatapp.realtimechat.security;

import java.security.Principal;

/**
 * Spring's simple broker needs a Principal per session to support
 * per-user destinations (/user/**) and so controller methods can accept
 * a Principal argument directly. getName() must return something stable
 * and unique — we use the userId (not username, which could change).
 */
public record StompPrincipal(String userId, String username) implements Principal {
    @Override
    public String getName() {
        return userId;
    }
}
