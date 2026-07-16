# Realtime Chat App — Scalable Architecture

Java 17 / Spring Boot 3.2 backend, React frontend, Redis Pub/Sub for
horizontal scale-out, PostgreSQL for persistence, optional Kafka for
async analytics/search-indexing/archival.

## 1. How a message travels from User A to User B across two instances

```
User A (connected to Instance 1)
   │  STOMP SEND /app/chat.sendMessage/{roomId}
   ▼
Instance 1: ChatController.sendMessage()
   │  1. persist to Postgres (source of truth)
   │  2. RedisMessagePublisher.publishChatMessage(roomId, msg)
   ▼
Redis PUBLISH  →  channel "chat:room:{roomId}"
   │
   ├──────────────────────────────┬─────────────────────────────┐
   ▼                               ▼                             ▼
Instance 1                    Instance 2                    Instance N
RedisMessageSubscriber        RedisMessageSubscriber        RedisMessageSubscriber
(SUBSCRIBEd to chat:room:*)   (SUBSCRIBEd to chat:room:*)   ...
   │                               │
   │ convertAndSend                │ convertAndSend
   │ to LOCAL sessions only        │ to LOCAL sessions only
   ▼                               ▼
(no one local, or User A's        User B's WebSocket session
 other tab, gets it here)         (connected here) gets it
                                        ▼
                                   User B sees the message
```

The key idea: **ChatController never calls `SimpMessagingTemplate` directly.**
It persists, then publishes to Redis and stops caring. Every instance
(including the sender's own) independently subscribes to Redis and is
responsible only for pushing to *its own* locally-connected WebSocket
sessions. Redis is what turns "N independent JVMs, each with its own local
STOMP broker" into one logical chat backend — no instance needs to know
where any other client is connected, and adding a 3rd, 4th, 10th instance
requires zero code changes.

Presence works the same way: `PresenceEventListener` writes ONLINE/OFFLINE
to a Redis key (with TTL, so a crashed instance doesn't leave a user stuck
online) and publishes to a shared `chat:presence` channel, which every
instance's subscriber turns into a `/topic/presence` broadcast.

### Why Kafka is layered on top of this, not instead of it

Redis Pub/Sub has no persistence and no replay — a subscriber that isn't
listening at the exact moment of a PUBLISH simply never sees it. That's
fine (even ideal) for live chat delivery, but wrong for analytics,
search-indexing, or archival, which need durability and independent,
restart-safe consumer groups. `AnalyticsEventProducer` fires each sent
message onto a `chat-message-events` Kafka topic, keyed by `roomId` for
per-room ordering. A downstream analytics consumer, a search-indexing
consumer, and an archival consumer can each read that topic independently,
fall behind, restart, or go down entirely without affecting live chat at
all — because the live chat path already completed via Redis before Kafka
is ever touched, and the Kafka publish is fire-and-forget (any failure is
swallowed and logged, never propagated back to the user).

## 2. Project structure

```
realtime-chat-app/
├── docker-compose.yml
├── nginx/
│   └── nginx.conf
├── backend/
│   ├── Dockerfile
│   ├── pom.xml
│   └── src/main/
│       ├── resources/application.yml
│       └── java/com/chatapp/realtimechat/
│           ├── RealtimeChatApplication.java
│           ├── config/
│           │   ├── WebSocketConfig.java       # STOMP endpoint + interceptor wiring
│           │   ├── RedisConfig.java           # RedisTemplate + listener container
│           │   └── SecurityConfig.java        # stateless REST security
│           ├── security/
│           │   ├── JwtChannelInterceptor.java # <-- CORE: authenticates STOMP CONNECT
│           │   ├── JwtService.java
│           │   └── StompPrincipal.java
│           ├── redis/
│           │   ├── RedisMessagePublisher.java # only writer to Redis
│           │   └── RedisMessageSubscriber.java# <-- CORE: fan-out to local clients
│           ├── controller/
│           │   └── ChatController.java        # STOMP @MessageMapping endpoints
│           ├── listener/
│           │   └── PresenceEventListener.java # connect/disconnect -> Redis
│           ├── kafka/
│           │   ├── KafkaProducerConfig.java
│           │   └── AnalyticsEventProducer.java
│           ├── dto/
│           │   ├── ChatMessageDto.java
│           │   └── PresenceEventDto.java
│           └── service/
│               └── ChatMessageService.java    # interface only; JPA impl is ordinary CRUD
└── frontend/
    ├── package.json
    └── src/
        ├── hooks/
        │   └── useChatWebSocket.js             # <-- CORE: connection + reconnection logic
        └── components/
            └── ChatRoom.jsx                     # sidebar + message window
```

## 3. Running it

```bash
# from realtime-chat-app/
docker compose up --build
```

- `app-instance-1` → http://localhost:8081
- `app-instance-2` → http://localhost:8082
- Load-balanced entrypoint → http://localhost:8080 (nginx, round-robins/sticky across both)
- Swagger UI (per instance) → http://localhost:8081/swagger-ui.html

Point your React app's `REACT_APP_WS_URL` at `http://localhost:8080/ws`
(the nginx entrypoint) to see messages survive being served by either
backend instance — that's the real proof the Redis Pub/Sub wiring works,
not just that a single instance echoes messages back to itself.

## 4. What's intentionally NOT included

Per project scope, ordinary CRUD (JPA entities for `ChatMessage`, `User`,
`ChatRoom`, their repositories, and the login/register REST controller)
is left out — none of it is unique to the WebSocket/Redis/Kafka
architecture, and it's the kind of thing already covered by your
ShelfWise backend. `ChatMessageService` is left as an interface with a
comment on exactly what the JPA implementation should do.
