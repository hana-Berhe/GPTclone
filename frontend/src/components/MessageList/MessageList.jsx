import { useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, LoaderCircle } from "lucide-react";
import ChatMessage from "../ChatMessage/ChatMessage";
import styles from "./MessageList.module.css";

const NEAR_BOTTOM_PX = 80;

export default function MessageList({ chatKey, messages, isLoading, error, onNewChat }) {
  const scrollRef = useRef(null);
  const stickToBottomRef = useRef(true);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const scrollToBottom = (behavior = "auto") => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior });
  };

  // Opening another chat always starts at the bottom
  useLayoutEffect(() => {
    stickToBottomRef.current = true;
  }, [chatKey]);

  // Follow new text while streaming, unless the user scrolled up to read
  useLayoutEffect(() => {
    if (stickToBottomRef.current) scrollToBottom();
  }, [messages, isLoading]);

  const handleScroll = () => {
    const el = scrollRef.current;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distance < NEAR_BOTTOM_PX;
    stickToBottomRef.current = nearBottom;
    setShowScrollButton(!nearBottom);
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.messages} ref={scrollRef} onScroll={handleScroll}>
        {isLoading ? (
          <div className={styles.center}>
            <LoaderCircle className="spin" size={24} />
          </div>
        ) : error ? (
          <div className={styles.center}>
            <p>{error}</p>
            <button type="button" className={styles.newChatBtn} onClick={onNewChat}>
              Start a new chat
            </button>
          </div>
        ) : (
          messages.map((message) => <ChatMessage key={message.id} message={message} />)
        )}
      </div>

      {showScrollButton && !isLoading && (
        <button
          type="button"
          className={styles.scrollBtn}
          onClick={() => {
            stickToBottomRef.current = true;
            scrollToBottom("smooth");
          }}
          aria-label="Scroll to bottom"
        >
          <ArrowDown size={18} />
        </button>
      )}
    </div>
  );
}
