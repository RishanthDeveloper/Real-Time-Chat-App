/**
 * Part of the RealtimeChat frontend — github.com/RishanthDeveloper
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useChatStore } from "../store/chatStore";
import { useChatWebSocket } from "../hooks/useChatWebSocket";
import AvatarCanvas from "./AvatarCanvas";
import ConnectionMonitor from "./ConnectionMonitor";
import MessageBubble from "./MessageBubble";

const GROUP_WINDOW_MS = 2 * 60 * 1000;
const MAX_TEXTAREA_HEIGHT = 160;

function dayLabel(ts) {
  const d = new Date(ts);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const yest = new Date(today);
  yest.setDate(yest.getDate() - 1);
  const isYesterday = d.toDateString() === yest.toDateString();
  if (isToday) return "Today";
  if (isYesterday) return "Yesterday";
  return d.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });
}

export default function ChatRoom() {
  const currentUser = useChatStore((s) => s.currentUser);
  const rooms = useChatStore((s) => s.rooms);
  const directMessages = useChatStore((s) => s.directMessages);
  const activeRoomId = useChatStore((s) => s.activeRoomId);
  const setActiveRoomId = useChatStore((s) => s.setActiveRoomId);
  const unreadByRoom = useChatStore((s) => s.unreadByRoom);
  const onlineUsers = useChatStore((s) => s.onlineUsers);
  const typingByRoom = useChatStore((s) => s.typingByRoom);
  const messagesByRoom = useChatStore((s) => s.messagesByRoom);
  const usersDrawerOpen = useChatStore((s) => s.usersDrawerOpen);
  const toggleUsersDrawer = useChatStore((s) => s.toggleUsersDrawer);
  const searchOverlayOpen = useChatStore((s) => s.searchOverlayOpen);
  const toggleSearchOverlay = useChatStore((s) => s.toggleSearchOverlay);

  const { sendMessage, sendTyping } = useChatWebSocket();

  const [draft, setDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
  const searchInputRef = useRef(null);

  const messages = messagesByRoom[activeRoomId] || [];
  const typingUsers = Array.from(typingByRoom[activeRoomId] || []);
  const onlineList = Object.entries(onlineUsers).filter(([, u]) => u.status === "ONLINE");

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  // FIX (#1, textarea auto-resize): collapsing to "auto" and immediately
  // reading scrollHeight is unreliable when text SHRINKS. In several
  // browsers, setting height to "auto" doesn't force a synchronous reflow
  // before the next line reads scrollHeight — the element can still report
  // its *previous* (taller) scrollHeight, so deleting text back down to one
  // line leaves the textarea visually stuck at its old height.
  //
  // Collapsing to "0px" first is the robust version: 0px is an explicit,
  // unambiguous value the browser must lay out before scrollHeight is read
  // again, so the very next read is guaranteed to reflect only the current
  // content, not a stale layout from before the change.
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    const next = Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT);
    el.style.height = `${next}px`;
  }, []);

  // Exhaustive: draft/sendMessage/autoResize are all read here and are all
  // now listed, so this can safely become useCallback instead of a bare
  // function recreated every render.
  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();
      if (!draft.trim()) return;
      sendMessage(draft.trim());
      setDraft("");
      requestAnimationFrame(autoResize);
    },
    [draft, sendMessage, autoResize]
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e);
      }
    },
    [handleSubmit]
  );

  // FIX (#4, a11y / keyboard nav): Escape closes the search overlay, which
  // is standard behavior for any dismissible overlay and is required for
  // keyboard-only users who opened it but don't want to tab all the way
  // through it to leave.
  const handleSearchKeyDown = useCallback(
    (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        toggleSearchOverlay();
        setSearchQuery("");
      }
    },
    [toggleSearchOverlay]
  );

  // Group consecutive messages from the same sender within a short window,
  // and inject date-divider markers between days — computed once per render
  // of the message list, not per bubble.
  const renderItems = useMemo(() => {
    const items = [];
    let lastDay = null;
    let lastSenderId = null;
    let lastTs = 0;

    for (const msg of messages) {
      const day = new Date(msg.timestamp).toDateString();
      if (day !== lastDay) {
        items.push({ kind: "divider", key: `divider-${day}`, label: dayLabel(msg.timestamp) });
        lastDay = day;
        lastSenderId = null;
      }
      const grouped =
        msg.senderId === lastSenderId && new Date(msg.timestamp).getTime() - lastTs < GROUP_WINDOW_MS;
      items.push({ kind: "message", key: msg.id ?? `${msg.senderId}-${msg.timestamp}`, message: msg, grouped });
      lastSenderId = msg.senderId;
      lastTs = new Date(msg.timestamp).getTime();
    }
    return items;
  }, [messages]);

  const filteredMessages = searchQuery
    ? messages.filter((m) => m.content?.toLowerCase().includes(searchQuery.toLowerCase()))
    : null;

  return (
    <div className="flex h-screen bg-bg-deep text-text-primary font-sans overflow-hidden">
      {/* ---------- Left sidebar ---------- */}
      <aside className="w-64 flex-shrink-0 bg-surface border-r border-border flex flex-col" aria-label="Workspace navigation">
        {/* Workspace switcher */}
        <div className="h-14 px-4 flex items-center gap-2 border-b border-border">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-sm font-bold" aria-hidden="true">
            SW
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">ShelfWise Workspace</p>
            <p className="text-[11px] text-text-muted truncate">{currentUser?.username || "Guest"}</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto scroll-thin px-3 py-4 space-y-5" aria-label="Channels and direct messages">
          <div>
            <h3 className="px-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-1.5" id="channels-heading">
              Channels
            </h3>
            <ul className="space-y-0.5" aria-labelledby="channels-heading">
              {rooms.map((room) => {
                const unread = unreadByRoom[room.id] || 0;
                const active = room.id === activeRoomId;
                return (
                  <li key={room.id}>
                    <button
                      onClick={() => setActiveRoomId(room.id)}
                      aria-current={active ? "true" : undefined}
                      aria-label={
                        unread > 0 && !active
                          ? `${room.name} channel, ${unread} unread message${unread === 1 ? "" : "s"}`
                          : `${room.name} channel`
                      }
                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors ${
                        active ? "bg-primary text-white" : "text-text-secondary hover:bg-surface-raised"
                      }`}
                    >
                      <span className="truncate" aria-hidden="true"># {room.name}</span>
                      {unread > 0 && !active && (
                        <span
                          className="bg-danger text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-[18px] text-center"
                          aria-hidden="true"
                        >
                          {unread > 9 ? "9+" : unread}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <h3 className="px-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-1.5" id="dms-heading">
              Direct Messages
            </h3>
            <ul className="space-y-0.5" aria-labelledby="dms-heading">
              {directMessages.map((dm) => {
                const unread = unreadByRoom[dm.id] || 0;
                const active = dm.id === activeRoomId;
                return (
                  <li key={dm.id}>
                    <button
                      onClick={() => setActiveRoomId(dm.id)}
                      aria-current={active ? "true" : undefined}
                      aria-label={
                        unread > 0 && !active
                          ? `Direct message with ${dm.name}, ${unread} unread message${unread === 1 ? "" : "s"}`
                          : `Direct message with ${dm.name}`
                      }
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                        active ? "bg-primary text-white" : "text-text-secondary hover:bg-surface-raised"
                      }`}
                    >
                      <AvatarCanvas username={dm.name} status="offline" size={20} />
                      <span className="truncate flex-1 text-left" aria-hidden="true">{dm.name}</span>
                      {unread > 0 && !active && (
                        <span
                          className="bg-danger text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-[18px] text-center"
                          aria-hidden="true"
                        >
                          {unread > 9 ? "9+" : unread}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>

        {/* User profile bar */}
        <div className="h-16 px-3 border-t border-border flex items-center gap-2">
          <AvatarCanvas username={currentUser?.username || "Guest"} status="online" size={32} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{currentUser?.username || "Guest"}</p>
            <p className="text-[11px] text-online">Online</p>
          </div>
        </div>
      </aside>

      {/* ---------- Main panel ---------- */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 flex-shrink-0 px-5 flex items-center justify-between border-b border-border">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold truncate"># {activeRoomId}</h2>
            {/* FIX (#4): aria-live announces typing status changes without
                the screen reader needing to be focused on this element. */}
            {typingUsers.length > 0 && (
              <div className="flex items-center gap-1.5 text-[11px] text-text-muted" aria-live="polite" aria-atomic="true">
                <span className="truncate">
                  {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing
                </span>
                <span className="flex gap-0.5" aria-hidden="true">
                  <span className="typing-dot h-1 w-1 rounded-full bg-text-muted inline-block" />
                  <span className="typing-dot h-1 w-1 rounded-full bg-text-muted inline-block" />
                  <span className="typing-dot h-1 w-1 rounded-full bg-text-muted inline-block" />
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <ConnectionMonitor />
            <button
              onClick={toggleSearchOverlay}
              aria-label={searchOverlayOpen ? "Close search" : "Search messages"}
              aria-pressed={searchOverlayOpen}
              className="p-2 rounded-md hover:bg-surface-raised text-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span aria-hidden="true">🔍</span>
            </button>
            <button
              onClick={toggleUsersDrawer}
              aria-label={usersDrawerOpen ? "Hide active users" : "Show active users"}
              aria-pressed={usersDrawerOpen}
              className="p-2 rounded-md hover:bg-surface-raised text-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span aria-hidden="true">👥</span>
            </button>
          </div>
        </header>

        {/* Search overlay */}
        {searchOverlayOpen && (
          <div className="glass-panel animate-fade-in px-5 py-2 border-b border-border">
            <label htmlFor="message-search" className="sr-only">
              Search in #{activeRoomId}
            </label>
            <input
              id="message-search"
              ref={searchInputRef}
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder={`Search in #${activeRoomId}…`}
              className="w-full bg-surface-raised border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        )}

        <div className="flex-1 flex min-h-0">
          {/* Message stream. FIX (#4): role="log" + aria-live="polite" makes
              this a standard live region — screen readers announce newly
              appended messages without the user needing to move focus into
              the stream, the same pattern Slack/Discord use for their
              message panes. aria-relevant="additions" avoids re-announcing
              the entire history on every re-render, only new nodes. */}
          <div
            ref={scrollRef}
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            aria-label={`Messages in ${activeRoomId}`}
            className="flex-1 overflow-y-auto scroll-thin py-3"
          >
            {filteredMessages ? (
              filteredMessages.map((m) => (
                <MessageBubble
                  key={m.id}
                  message={m}
                  isGroupedWithPrevious={false}
                  // FIX: this branch previously omitted isOwn entirely, so
                  // every bubble in a search result rendered as "someone
                  // else's" message regardless of sender — a real
                  // left/right-alignment bug that only showed up once you
                  // actually typed something into search.
                  isOwn={m.senderId === currentUser?.id}
                />
              ))
            ) : renderItems.length === 0 ? (
              <div className="h-full flex items-center justify-center text-text-muted text-sm">
                No messages yet — say hello 👋
              </div>
            ) : (
              renderItems.map((item) =>
                item.kind === "divider" ? (
                  <div key={item.key} className="flex items-center gap-3 px-5 my-3" role="separator" aria-label={item.label}>
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[11px] text-text-muted font-medium">{item.label}</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                ) : (
                  <MessageBubble
                    key={item.key}
                    message={item.message}
                    isGroupedWithPrevious={item.grouped}
                    isOwn={item.message.senderId === currentUser?.id}
                  />
                )
              )
            )}
          </div>

          {/* Active users drawer */}
          {usersDrawerOpen && (
            <aside
              className="w-56 flex-shrink-0 border-l border-border bg-surface animate-fade-in overflow-y-auto scroll-thin"
              aria-label="Active users"
            >
              <h3 className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                Online — {onlineList.length}
              </h3>
              <ul className="px-2 space-y-0.5">
                {onlineList.map(([id, u]) => (
                  <li key={id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-surface-raised">
                    <AvatarCanvas username={u.username} status="online" size={24} />
                    <span className="text-sm text-text-secondary truncate">{u.username}</span>
                  </li>
                ))}
              </ul>
            </aside>
          )}
        </div>

        {/* Composer */}
        <form onSubmit={handleSubmit} className="px-5 py-3 border-t border-border">
          <div className="flex items-end gap-2 bg-surface-raised border border-border rounded-lg px-3 py-2 focus-within:ring-1 focus-within:ring-primary">
            <button
              type="button"
              aria-label="Attach file"
              className="text-text-muted hover:text-text-primary p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
            >
              <span aria-hidden="true">📎</span>
            </button>
            <label htmlFor="message-composer" className="sr-only">
              Message #{activeRoomId}
            </label>
            <textarea
              id="message-composer"
              ref={textareaRef}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                sendTyping();
                autoResize();
              }}
              onKeyDown={handleKeyDown}
              placeholder={`Message #${activeRoomId}`}
              rows={1}
              className="flex-1 bg-transparent resize-none focus:outline-none text-sm placeholder:text-text-muted max-h-40"
            />
            <button
              type="button"
              aria-label="Add emoji"
              className="text-text-muted hover:text-text-primary p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
            >
              <span aria-hidden="true">🙂</span>
            </button>
            <button
              type="submit"
              disabled={!draft.trim()}
              aria-label="Send message"
              className="bg-primary hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"
            >
              Send
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
