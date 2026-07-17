import DOMPurify from "dompurify";

/**
 * Every chat payload rendered as HTML MUST go through this. Message content
 * is untrusted user input from potentially any other user in the room —
 * without this, a message body like <img src=x onerror=alert(1)> would
 * execute in every other viewer's browser the instant it renders.
 *
 * We only allow a small formatting subset (bold/italic/code/links/line
 * breaks) — enough for a chat app's "rich text", nothing that can carry
 * script execution or event-handler attributes.
 */
const ALLOWED_TAGS = ["b", "strong", "i", "em", "code", "pre", "br", "a", "span"];
const ALLOWED_ATTR = ["href", "target", "rel", "class"];

export function sanitizeMessageHtml(rawHtml) {
  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
}

/** Plain-text escape for contexts where we don't want any HTML at all. */
export function escapePlainText(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

/**
 * Very small, safe fenced-code-block detector for the message stream.
 * Splits message content into text/code segments WITHOUT ever using
 * dangerouslySetInnerHTML on the code body itself — code content is always
 * rendered as plain React text nodes, so no sanitization gap is possible
 * even if this parser has a bug.
 */
export function splitCodeSegments(content) {
  const segments = [];
  const fenceRegex = /```(\w*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = fenceRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: content.slice(lastIndex, match.index) });
    }
    segments.push({ type: "code", lang: match[1] || "text", value: match[2] });
    lastIndex = fenceRegex.lastIndex;
  }
  if (lastIndex < content.length) {
    segments.push({ type: "text", value: content.slice(lastIndex) });
  }
  return segments.length ? segments : [{ type: "text", value: content }];
}
