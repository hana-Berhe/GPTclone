import { useLayoutEffect, useRef, useState } from "react";
import { ArrowUp, Square } from "lucide-react";
import styles from "./ChatInput.module.css";

const MAX_HEIGHT = 200;
const canHover = () => window.matchMedia("(hover: hover) and (pointer: fine)").matches;

export default function ChatInput({ onSend, onStop, isStreaming, disabled = false }) {
  const [input, setInput] = useState("");
  const textareaRef = useRef(null);

  // Grow the textarea with its content, up to MAX_HEIGHT
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? "auto" : "hidden";
  }, [input]);

  // Focus on desktop when the input appears (skip on phones so the keyboard doesn't pop up)
  useLayoutEffect(() => {
    if (canHover()) textareaRef.current?.focus();
  }, []);

  const canSend = input.trim().length > 0 && !isStreaming && !disabled;

  const submit = () => {
    if (!canSend) return;
    onSend(input.trim());
    setInput("");
  };

  const handleKeyDown = (event) => {
    // Enter sends, Shift+Enter adds a new line. Ignore Enter while an IME is composing.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className={styles.container}>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <textarea
          ref={textareaRef}
          className={styles.input}
          placeholder="Ask anything"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={disabled}
          aria-label="Message"
        />

        {isStreaming ? (
          <button
            type="button"
            className={styles.sendBtn}
            onClick={onStop}
            aria-label="Stop generating"
          >
            <Square size={14} fill="currentColor" />
          </button>
        ) : (
          <button
            type="submit"
            className={styles.sendBtn}
            disabled={!canSend}
            aria-label="Send message"
          >
            <ArrowUp size={20} />
          </button>
        )}
      </form>
      <p className={styles.disclaimer}>AI can make mistakes. Check important info.</p>
    </div>
  );
}
