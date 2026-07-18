import React, { useEffect } from "react";
import ChatRoom from "./components/ChatRoom";
import { useChatStore } from "./store/chatStore";

/**
 * In a real app, token + currentUser come from your login flow (REST call
 * to /api/auth/login, which is ordinary CRUD-adjacent and intentionally
 * left out of this deliverable). Wired here via setAuth so ChatRoom and
 * useChatWebSocket both read from the same store.
 */
export default function App() {
  const setAuth = useChatStore((s) => s.setAuth);

  useEffect(() => {
    const token = window.localStorage.getItem("chat_jwt"); // replace with your real auth flow
    const currentUser = { id: "demo-user", username: "You" };
    if (token) setAuth(token, currentUser);
  }, [setAuth]);

  return <ChatRoom />;
}
