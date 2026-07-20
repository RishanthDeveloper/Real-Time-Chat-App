import { useEffect, useRef, useCallback } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { useChatStore } from "../store/chatStore";

const WS_URL = process.env.REACT_APP_WS_URL || "http://localhost:8080/ws";
const BASE_RECONNECT_DELAY_MS = 2000;
const MAX_RECONNECT_ATTEMPTS = 10;
const PING_INTERVAL_MS = 5000;

/**
 * Owns the single live STOMP connection for the app's lifetime. All state
 * updates flow into the Zustand store (connection status, instance id,
 * latency, presence, typing, messages, unread counts) so any component can
 * read them without holding a reference to the socket.
 */
export function useChatWebSocket() {
  const clientRef = useRef(null);
  const roomSubRef = useRef(null);
  const typingSubRef = useRef(null);
  const presenceSubRef = useRef(null);
  const pongSubRef = useRef(null);
  const pingTimerRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectAttempts = useRef(0);

  // FIX (#3, memory leaks / race conditions): a mount guard. Without this,
  // a STOMP callback that fires AFTER the component has unmounted (e.g. the
  // WebSocket's close event arrives a few ms after React already ran the
  // cleanup) can still schedule a reconnect timer, publish a ping, or touch
  // Zustand setters. The setters themselves are harmless post-unmount, but
  // the *timers* they schedule are not — they're new intervals/timeouts
  // created after cleanup already ran, so cleanup never had a chance to
  // clear them. That's the actual leak in a rapid mount/unmount/remount
  // scenario (e.g. React StrictMode's double-invoke, or a user navigating
  // away and back quickly).
  const isMountedRef = useRef(true);

  // FIX (#2, stale closure): activeRoomId is read inside onConnect, which is
  // defined once when the `[token]` effect runs and is NOT re-created when
  // the user switches rooms. Previously onConnect closed over whatever
  // activeRoomId was at *initial connect* time, so a reconnect after a room
  // switch would silently resubscribe to the wrong room. A ref that's kept
  // in sync via its own effect gives onConnect a way to read the CURRENT
  // room without needing the outer effect to depend on activeRoomId (which
  // would tear down and recreate the whole socket on every room switch —
  // exactly what the separate resubscription effect below is designed to
  // avoid).
  const activeRoomIdRef = useRef(null);

  const token = useChatStore((s) => s.token);
  const activeRoomId = useChatStore((s) => s.activeRoomId);

  const setConnectionState = useChatStore((s) => s.setConnectionState);
  const setInstanceId = useChatStore((s) => s.setInstanceId);
  const setLatency = useChatStore((s) => s.setLatency);
  const setPresence = useChatStore((s) => s.setPresence);
  const setTyping = useChatStore((s) => s.setTyping);
  const appendMessage = useChatStore((s) => s.appendMessage);
  const incrementUnread = useChatStore((s) => s.incrementUnread);

  useEffect(() => {
    activeRoomIdRef.current = activeRoomId;
  }, [activeRoomId]);

  const subscribeToRoom = useCallback(
    (client, roomId) => {
      if (roomSubRef.current) {
        roomSubRef.current.unsubscribe();
        roomSubRef.current = null;
      }
      if (typingSubRef.current) {
        typingSubRef.current.unsubscribe();
        typingSubRef.current = null;
      }
      if (!roomId) return;

      roomSubRef.current = client.subscribe(`/topic/room.${roomId}.messages`, (frame) => {
        const body = JSON.parse(frame.body);
        appendMessage(roomId, body);
        incrementUnread(roomId);
      });

      typingSubRef.current = client.subscribe(`/topic/room.${roomId}.typing`, (frame) => {
        const body = JSON.parse(frame.body);
        setTyping(roomId, body.senderUsername, true);
        setTimeout(() => setTyping(roomId, body.senderUsername, false), 3000);
      });
    },
    [appendMessage, incrementUnread, setTyping]
  );

  useEffect(() => {
    if (!token) return;

    isMountedRef.current = true;

    const scheduleReconnect = () => {
      // FIX (#3): clear any already-pending reconnect timer before
      // scheduling a new one. Without this, two close events in quick
      // succession (which does happen — a flaky connection can fire
      // onWebSocketClose more than once around a single drop) would
      // overwrite reconnectTimerRef with the second timer's id, orphaning
      // the first one. The orphaned timeout still fires later and still
      // calls activate(), producing a duplicate/racy reconnect attempt that
      // cleanup can no longer cancel because the ref no longer points to it.
      clearTimeout(reconnectTimerRef.current);

      if (!isMountedRef.current) return;

      if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
        setConnectionState(false, "Unable to reconnect after multiple attempts. Please refresh.");
        return;
      }
      reconnectAttempts.current += 1;
      const delay = BASE_RECONNECT_DELAY_MS * Math.min(reconnectAttempts.current, 5);
      reconnectTimerRef.current = setTimeout(() => {
        if (isMountedRef.current) clientRef.current?.activate();
      }, delay);
    };

    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 0, // manual backoff via scheduleReconnect, not stompjs's built-in fixed-interval retry
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,

      onConnect: (frame) => {
        if (!isMountedRef.current) {
          // The component unmounted while the socket was mid-handshake.
          // Tear this connection straight back down instead of wiring up
          // subscriptions and timers nobody will ever clean up.
          client.deactivate();
          return;
        }

        reconnectAttempts.current = 0;
        setConnectionState(true, null);
        setInstanceId(frame.headers["instance-id"] || null);

        // FIX (#2): read the CURRENT room via the ref, not the activeRoomId
        // captured in this effect's closure — see activeRoomIdRef comment above.
        subscribeToRoom(client, activeRoomIdRef.current);

        presenceSubRef.current = client.subscribe("/topic/presence", (f) => {
          const p = JSON.parse(f.body);
          setPresence(p.userId, p.username, p.status);
        });

        pongSubRef.current = client.subscribe("/user/queue/pong", (f) => {
          const pong = JSON.parse(f.body);
          setLatency(Date.now() - pong.clientTimestamp);
        });

        // FIX (#3): clear before setting. onConnect can legitimately fire
        // more than once per component lifetime (every reconnect runs this
        // whole callback again) — without this line, each reconnect stacks
        // another setInterval on top of the previous one, so after a couple
        // of drops the client is silently sending N pings every 5s instead
        // of 1, multiplying both network chatter and setLatency updates.
        clearInterval(pingTimerRef.current);
        pingTimerRef.current = setInterval(() => {
          client.publish({
            destination: "/app/ping",
            body: JSON.stringify({ clientTimestamp: Date.now() }),
          });
        }, PING_INTERVAL_MS);
      },

      onStompError: (frame) => {
        if (!isMountedRef.current) return;
        setConnectionState(false, frame.headers?.message || "STOMP protocol error");
      },

      onWebSocketClose: () => {
        if (!isMountedRef.current) return;
        setConnectionState(false, null);
        clearInterval(pingTimerRef.current);
        scheduleReconnect();
      },

      onDisconnect: () => {
        if (!isMountedRef.current) return;
        setConnectionState(false, null);
      },
    });

    clientRef.current = client;
    client.activate();

    return () => {
      // FIX (#3): flip the guard FIRST, before anything else runs. Any
      // in-flight callback (onConnect arriving late, a scheduled reconnect
      // firing right as cleanup starts) checks this flag before doing
      // anything stateful, so ordering it first closes the race window as
      // tightly as possible.
      isMountedRef.current = false;

      clearTimeout(reconnectTimerRef.current);
      clearInterval(pingTimerRef.current);
      roomSubRef.current?.unsubscribe();
      typingSubRef.current?.unsubscribe();
      presenceSubRef.current?.unsubscribe();
      pongSubRef.current?.unsubscribe();
      client.deactivate();
      clientRef.current = null;
    };
    // FIX (#2, exhaustive deps): intentionally still just [token]. Adding
    // activeRoomId here would recreate the entire socket (disconnect +
    // reconnect) on every room switch, which defeats the whole point of the
    // separate resubscription effect below. The eslint-disable is
    // deliberate and now safe, because the one place that used to read
    // activeRoomId from this closure (onConnect) reads activeRoomIdRef.current
    // instead — there is no longer any state in this effect's body that
    // silently goes stale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Room switches re-subscribe without reconnecting the underlying socket.
  // Exhaustive: activeRoomId (what changed) and subscribeToRoom (stable
  // reference, but included per the rule) are the only two things this
  // effect reads.
  useEffect(() => {
    if (clientRef.current?.connected) {
      subscribeToRoom(clientRef.current, activeRoomId);
    }
  }, [activeRoomId, subscribeToRoom]);

  const sendMessage = useCallback(
    (content) => {
      if (!clientRef.current?.connected || !activeRoomId || !content?.trim()) return;
      clientRef.current.publish({
        destination: `/app/chat.sendMessage/${activeRoomId}`,
        body: JSON.stringify({ content }),
      });
    },
    [activeRoomId]
  );

  const sendTyping = useCallback(() => {
    if (!clientRef.current?.connected || !activeRoomId) return;
    clientRef.current.publish({
      destination: `/app/chat.typing/${activeRoomId}`,
      body: JSON.stringify({}),
    });
  }, [activeRoomId]);

  return { sendMessage, sendTyping };
}
