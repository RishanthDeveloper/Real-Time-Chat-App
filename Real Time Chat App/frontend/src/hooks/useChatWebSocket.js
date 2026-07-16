import { useEffect, useRef, useState, useCallback } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

const WS_URL = process.env.REACT_APP_WS_URL || "http://localhost:8080/ws";
const BASE_RECONNECT_DELAY_MS = 2000;
const MAX_RECONNECT_ATTEMPTS = 10;

/**
 * Manages a single STOMP-over-SockJS connection for the lifetime of a
 * component. Handles:
 *  - passing the JWT via STOMP connectHeaders (NOT a URL query param or
 *    custom HTTP header — see backend JwtChannelInterceptor for why)
 *  - subscribing to the active room's topic and re-subscribing on room switch
 *    without tearing down the whole connection
 *  - a global presence topic
 *  - manual exponential-ish backoff reconnection (reconnectDelay is set to 0
 *    on the client so WE control retry timing/limits instead of stompjs's
 *    built-in fixed-interval retry)
 */
export function useChatWebSocket({ token, roomId, onMessage, onPresence }) {
  const clientRef = useRef(null);
  const roomSubRef = useRef(null);
  const presenceSubRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimerRef = useRef(null);

  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);

  const subscribeToRoom = useCallback(
    (client, activeRoomId) => {
      if (roomSubRef.current) {
        roomSubRef.current.unsubscribe();
        roomSubRef.current = null;
      }
      if (!activeRoomId) return;

      roomSubRef.current = client.subscribe(`/topic/room.${activeRoomId}`, (frame) => {
        onMessage?.(JSON.parse(frame.body));
      });
    },
    [onMessage]
  );

  useEffect(() => {
    if (!token) return;

    const scheduleReconnect = () => {
      if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
        setError("Unable to reconnect after multiple attempts. Please refresh.");
        return;
      }
      reconnectAttempts.current += 1;
      const delay = BASE_RECONNECT_DELAY_MS * Math.min(reconnectAttempts.current, 5);
      reconnectTimerRef.current = setTimeout(() => {
        clientRef.current?.activate();
      }, delay);
    };

    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      reconnectDelay: 0, // manual backoff via scheduleReconnect instead
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,

      onConnect: () => {
        reconnectAttempts.current = 0;
        setConnected(true);
        setError(null);

        subscribeToRoom(client, roomId);

        presenceSubRef.current = client.subscribe("/topic/presence", (frame) => {
          onPresence?.(JSON.parse(frame.body));
        });
      },

      onStompError: (frame) => {
        setError(frame.headers?.message || "STOMP protocol error");
      },

      onWebSocketClose: () => {
        setConnected(false);
        scheduleReconnect();
      },

      onDisconnect: () => {
        setConnected(false);
      },
    });

    clientRef.current = client;
    client.activate();

    return () => {
      clearTimeout(reconnectTimerRef.current);
      roomSubRef.current?.unsubscribe();
      presenceSubRef.current?.unsubscribe();
      client.deactivate();
      clientRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Room switches re-subscribe without reconnecting the underlying socket.
  useEffect(() => {
    if (clientRef.current && connected) {
      subscribeToRoom(clientRef.current, roomId);
    }
  }, [roomId, connected, subscribeToRoom]);

  const sendMessage = useCallback(
    (content) => {
      if (!clientRef.current || !connected || !roomId || !content?.trim()) return;
      clientRef.current.publish({
        destination: `/app/chat.sendMessage/${roomId}`,
        body: JSON.stringify({ content }),
      });
    },
    [connected, roomId]
  );

  const sendTyping = useCallback(() => {
    if (!clientRef.current || !connected || !roomId) return;
    clientRef.current.publish({
      destination: `/app/chat.typing/${roomId}`,
      body: JSON.stringify({}),
    });
  }, [connected, roomId]);

  return { connected, error, sendMessage, sendTyping };
}
