import React, { useState, useEffect, useRef, useCallback } from "react";
import { useChatWebSocket } from "../hooks/useChatWebSocket";

export default function ChatRoom({ token, currentUser }) {
  const [rooms] = useState([
    { id: "general", name: "General" },
    { id: "random", name: "Random" },
    { id: "dev-talk", name: "Dev Talk" },
  ]);
  const [activeRoomId, setActiveRoomId] = useState("general");
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [onlineUsers, setOnlineUsers] = useState({});
  const scrollRef = useRef(null);

  const handleMessage = useCallback((msg) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const handlePresence = useCallback((event) => {
    setOnlineUsers((prev) => ({
      ...prev,
      [event.userId]: { username: event.username, status: event.status },
    }));
  }, []);

  const { connected, error, sendMessage, sendTyping } = useChatWebSocket({
    token,
    roomId: activeRoomId,
    onMessage: handleMessage,
    onPresence: handlePresence,
  });

  useEffect(() => {
    // In production, fetch REST message history for the room here instead
    // of just clearing — the WebSocket only carries *new* messages going forward.
    setMessages([]);
  }, [activeRoomId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!draft.trim()) return;
    sendMessage(draft.trim());
    setDraft("");
  };

  const onlineList = Object.entries(onlineUsers).filter(([, u]) => u.status === "ONLINE");

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-slate-800 bg-slate-900 flex flex-col">
        <div className="p-4 border-b border-slate-800 flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${connected ? "bg-emerald-400" : "bg-rose-500"}`} />
          <span className="text-sm text-slate-400">{connected ? "Connected" : "Reconnecting…"}</span>
        </div>

        <div className="p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Rooms</h3>
          <ul className="space-y-1">
            {rooms.map((room) => (
              <li key={room.id}>
                <button
                  onClick={() => setActiveRoomId(room.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
                    activeRoomId === room.id
                      ? "bg-indigo-600 text-white"
                      : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  # {room.name}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="p-4 mt-auto border-t border-slate-800">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
            Online ({onlineList.length})
          </h3>
          <ul className="space-y-1 max-h-48 overflow-y-auto">
            {onlineList.map(([id, u]) => (
              <li key={id} className="flex items-center gap-2 text-sm text-slate-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                {u.username}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Main chat window */}
      <main className="flex-1 flex flex-col">
        <header className="px-6 py-4 border-b border-slate-800">
          <h2 className="text-lg font-semibold"># {activeRoomId}</h2>
          {error && <p className="text-xs text-rose-400 mt-1">{error}</p>}
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {messages.map((msg, idx) => {
            const isMine = msg.senderId === currentUser.id;
            return (
              <div key={msg.id ?? idx} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-md px-4 py-2 rounded-2xl text-sm ${
                    isMine
                      ? "bg-indigo-600 text-white rounded-br-sm"
                      : "bg-slate-800 text-slate-100 rounded-bl-sm"
                  }`}
                >
                  {!isMine && (
                    <p className="text-xs font-semibold text-indigo-300 mb-1">{msg.senderUsername}</p>
                  )}
                  <p>{msg.content}</p>
                  <p className="text-[10px] text-slate-400 mt-1 text-right">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="p-4 border-t border-slate-800 flex gap-2">
          <input
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              sendTyping();
            }}
            placeholder="Type a message…"
            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={!connected}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-2 rounded-xl text-sm font-medium transition"
          >
            Send
          </button>
        </form>
      </main>
    </div>
  );
}
