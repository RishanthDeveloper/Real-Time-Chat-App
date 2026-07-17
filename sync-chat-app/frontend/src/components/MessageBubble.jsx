import React, { useState } from "react";
import AvatarCanvas from "./AvatarCanvas";
import { splitCodeSegments, escapePlainText } from "../utils/sanitize";

/**
 * Renders one message. Grouped messages (same sender, <2min apart) omit the
 * repeated avatar/username header, Slack/Discord-style.
 *
 * SECURITY: message content is NEVER passed through dangerouslySetInnerHTML.
 * splitCodeSegments only decides where fenced code blocks start/end; both
 * text and code segments render as plain React children (auto-escaped by
 * React itself), so there is no path for injected HTML/script to execute
 * regardless of what a malicious sender puts in `content`.
 */
export default function MessageBubble({ message, isGroupedWithPrevious, isOwn }) {
  const [hovered, setHovered] = useState(false);
  const segments = splitCodeSegments(message.content || "");

  return (
    <div
      className={`group flex gap-3 px-4 py-1 rounded-lg transition-colors ${
        hovered ? "bg-surface-raised" : ""
      } ${isGroupedWithPrevious ? "mt-0.5" : "mt-3"}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="w-9 flex-shrink-0">
        {!isGroupedWithPrevious && <AvatarCanvas username={message.senderUsername} status="online" size={36} />}
      </div>

      <div className="flex-1 min-w-0">
        {!isGroupedWithPrevious && (
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="text-sm font-semibold text-text-primary">
              {escapePlainText(message.senderUsername)}
            </span>
            <span className="text-[11px] text-text-muted">
              {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        )}

        <div className="text-sm text-text-secondary leading-relaxed break-words">
          {segments.map((seg, i) =>
            seg.type === "code" ? (
              <pre
                key={i}
                className="my-1.5 rounded-md bg-bg-deep border border-border px-3 py-2 overflow-x-auto"
              >
                <code className="font-mono text-xs text-emerald-300 whitespace-pre">{seg.value}</code>
              </pre>
            ) : (
              <span key={i} className="whitespace-pre-wrap">
                {seg.value}
              </span>
            )
          )}
        </div>
      </div>

      {hovered && (
        <div className="flex items-start gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button className="p-1.5 rounded-md hover:bg-white/5 text-text-muted hover:text-text-primary text-xs" title="React">
            🙂
          </button>
          <button className="p-1.5 rounded-md hover:bg-white/5 text-text-muted hover:text-text-primary text-xs" title="Reply">
            ↩
          </button>
          <button className="p-1.5 rounded-md hover:bg-white/5 text-text-muted hover:text-text-primary text-xs" title="Copy">
            ⧉
          </button>
        </div>
      )}
    </div>
  );
}
