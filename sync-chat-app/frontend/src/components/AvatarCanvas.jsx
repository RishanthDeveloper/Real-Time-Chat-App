import React, { useEffect, useRef } from "react";

const RING_COLORS = {
  online: "#10B981",
  away: "#F59E0B",
  offline: "#4B5563",
  typing: "#6366F1",
};

// Fixed palette so a given username always renders the same fill color
// across the whole app — deterministic per-name, not random per mount.
const FALLBACK_PALETTE = ["#6366F1", "#EC4899", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", "#EF4444"];

function colorForName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return FALLBACK_PALETTE[Math.abs(hash) % FALLBACK_PALETTE.length];
}

function initialsFor(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * Circular avatar (initials fallback, deterministic fill color) with a
 * status ring drawn on the same canvas:
 *   - online:  solid emerald ring, gentle pulsing opacity
 *   - away:    solid amber ring, static
 *   - typing:  indigo ring with rotating dashed segments
 *   - offline: dim static gray ring
 *
 * Done on canvas rather than layered SVG/CSS specifically because the
 * typing animation needs a rotating dash-offset recomputed every frame —
 * a canvas arc redraw handles that cleanly and keeps the whole avatar
 * (fill + initials + ring) as a single paint operation.
 */
export default function AvatarCanvas({ username, status = "offline", size = 40 }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    const center = size / 2;
    const avatarRadius = size / 2 - 4;
    const ringRadius = size / 2 - 1.5;

    const fillColor = colorForName(username || "?");
    const initials = initialsFor(username || "?");

    let start = null;

    const draw = (timestamp) => {
      if (start === null) start = timestamp;
      const elapsed = timestamp - start;

      ctx.clearRect(0, 0, size, size);

      // Avatar disc
      ctx.beginPath();
      ctx.arc(center, center, avatarRadius, 0, Math.PI * 2);
      ctx.fillStyle = fillColor;
      ctx.fill();

      // Initials
      ctx.fillStyle = "#F9FAFB";
      ctx.font = `600 ${Math.round(size * 0.36)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(initials, center, center + 1);

      // Status ring
      if (status === "typing") {
        const dashCount = 8;
        const dashLength = (2 * Math.PI * ringRadius) / dashCount / 2;
        const rotation = (elapsed / 20) % 360;
        ctx.save();
        ctx.translate(center, center);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.translate(-center, -center);
        ctx.setLineDash([dashLength, dashLength]);
        ctx.beginPath();
        ctx.arc(center, center, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = RING_COLORS.typing;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      } else if (status === "online") {
        const pulse = 0.6 + 0.4 * Math.abs(Math.sin(elapsed / 600));
        ctx.beginPath();
        ctx.arc(center, center, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = RING_COLORS.online;
        ctx.globalAlpha = pulse;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else {
        ctx.beginPath();
        ctx.arc(center, center, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = RING_COLORS[status] || RING_COLORS.offline;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Static statuses (offline/away) don't need continuous redraws.
      if (status === "online" || status === "typing") {
        rafRef.current = requestAnimationFrame(draw);
      }
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [username, status, size]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${username || "User"} avatar, status: ${status}`}
    />
  );
}
