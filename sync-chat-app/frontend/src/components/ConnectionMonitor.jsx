import React, { useEffect, useRef, useState } from "react";
import { useChatStore } from "../store/chatStore";

const HISTORY_LENGTH = 30;
const MAX_PLOTTED_MS = 400; // clamp so one bad spike doesn't flatten the whole sparkline

function latencyColor(ms) {
  if (ms == null) return "#4B5563";
  if (ms < 100) return "#10B981";
  if (ms < 250) return "#F59E0B";
  return "#EF4444";
}

/**
 * Always-visible connection health widget: STOMP connection status, which
 * backend instance the session landed on (proves the nginx load balancer is
 * actually distributing across app-instance-1/2), and a rolling sparkline of
 * real app-level round-trip latency.
 *
 * Every number here comes straight from the store, which useChatWebSocket
 * populates from the real CONNECTED-frame "instance-id" header and real
 * /app/ping <-> /user/queue/pong round trips (see PingController on the
 * backend) — nothing in this component is simulated or hardcoded.
 */
export default function ConnectionMonitor() {
  const connected = useChatStore((s) => s.connected);
  const connectionError = useChatStore((s) => s.connectionError);
  const instanceId = useChatStore((s) => s.instanceId);
  const latencyMs = useChatStore((s) => s.latencyMs);

  const [history, setHistory] = useState([]);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (latencyMs == null) return;
    setHistory((prev) => [...prev.slice(-(HISTORY_LENGTH - 1)), latencyMs]);
  }, [latencyMs]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);
    if (history.length < 2) return;

    const step = w / (HISTORY_LENGTH - 1);
    const offset = HISTORY_LENGTH - history.length;

    ctx.beginPath();
    history.forEach((val, i) => {
      const x = (offset + i) * step;
      const clamped = Math.min(val, MAX_PLOTTED_MS);
      const y = h - (clamped / MAX_PLOTTED_MS) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = latencyColor(history[history.length - 1]);
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.stroke();
  }, [history]);

  return (
    <div className="glass-panel rounded-lg px-3 py-2 flex items-center gap-3 text-xs">
      <div className="flex items-center gap-1.5">
        <span
          className={`h-2 w-2 rounded-full ${connected ? "bg-online animate-pulse-ring" : "bg-danger"}`}
        />
        <span className="text-text-secondary">{connected ? "Connected" : "Reconnecting…"}</span>
      </div>

      <div className="w-px h-4 bg-white/10" />

      <div className="flex items-center gap-1.5 text-text-secondary" title="Backend instance this session is pinned to">
        <span className="font-mono">{instanceId ? instanceId.slice(0, 12) : "—"}</span>
      </div>

      <div className="w-px h-4 bg-white/10" />

      <canvas ref={canvasRef} width={64} height={20} className="opacity-90" />
      <span className="font-mono tabular-nums" style={{ color: latencyColor(latencyMs) }}>
        {latencyMs != null ? `${latencyMs}ms` : "—"}
      </span>

      {connectionError && <span className="text-danger">{connectionError}</span>}
    </div>
  );
}
