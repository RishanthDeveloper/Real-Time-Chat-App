import { create } from "zustand";

/**
 * Single source of truth for cross-component chat state.
 *
 * Deliberately split from useChatWebSocket: the STORE holds state, the HOOK
 * owns the live STOMP connection and pushes updates into the store's
 * setters. That split means any component (sidebar badge, header,
 * ConnectionMonitor, message stream) can read state without needing a
 * reference to the socket itself.
 */
export const useChatStore = create((set, get) => ({
  // --- auth ---
  token: null,
  currentUser: null,
  setAuth: (token, currentUser) => set({ token, currentUser }),

  // --- connection health (populated by useChatWebSocket from real
  //     CONNECTED-frame headers and /app/ping <-> /user/queue/pong round trips) ---
  connected: false,
  connectionError: null,
  instanceId: null, // which backend instance this session's CONNECTED frame reported
  latencyMs: null,
  setConnectionState: (connected, connectionError = null) => set({ connected, connectionError }),
  setInstanceId: (instanceId) => set({ instanceId }),
  setLatency: (latencyMs) => set({ latencyMs }),

  // --- rooms / channels ---
  rooms: [
    { id: "general", name: "general", type: "channel" },
    { id: "engineering", name: "engineering", type: "channel" },
    { id: "random", name: "random", type: "channel" },
  ],
  directMessages: [
    { id: "dm-priya", name: "Priya Shah", type: "dm" },
    { id: "dm-arjun", name: "Arjun Mehta", type: "dm" },
  ],
  activeRoomId: "general",
  setActiveRoomId: (roomId) => {
    // Entering a room clears its unread count.
    set((state) => ({
      activeRoomId: roomId,
      unreadByRoom: { ...state.unreadByRoom, [roomId]: 0 },
    }));
  },

  // --- unread badges: { roomId: count } ---
  unreadByRoom: {},
  incrementUnread: (roomId) => {
    const { activeRoomId } = get();
    if (roomId === activeRoomId) return; // don't badge the room you're currently viewing
    set((state) => ({
      unreadByRoom: { ...state.unreadByRoom, [roomId]: (state.unreadByRoom[roomId] || 0) + 1 },
    }));
  },

  // --- presence: { userId: { username, status } } ---
  onlineUsers: {},
  setPresence: (userId, username, status) =>
    set((state) => ({
      onlineUsers: { ...state.onlineUsers, [userId]: { username, status } },
    })),

  // --- typing indicator: { roomId: Set<username> } ---
  typingByRoom: {},
  setTyping: (roomId, username, isTyping) =>
    set((state) => {
      const current = new Set(state.typingByRoom[roomId] || []);
      isTyping ? current.add(username) : current.delete(username);
      return { typingByRoom: { ...state.typingByRoom, [roomId]: current } };
    }),

  // --- messages: { roomId: ChatMessageDto[] } ---
  messagesByRoom: {},
  appendMessage: (roomId, message) =>
    set((state) => ({
      messagesByRoom: {
        ...state.messagesByRoom,
        [roomId]: [...(state.messagesByRoom[roomId] || []), message],
      },
    })),

  // --- right-hand active users drawer + search overlay toggles ---
  usersDrawerOpen: false,
  searchOverlayOpen: false,
  toggleUsersDrawer: () => set((state) => ({ usersDrawerOpen: !state.usersDrawerOpen })),
  toggleSearchOverlay: () => set((state) => ({ searchOverlayOpen: !state.searchOverlayOpen })),
}));
