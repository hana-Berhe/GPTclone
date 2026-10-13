import { memo, useState } from "react";
import { AlertCircle, Check, Copy } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CodeBlock from "../CodeBlock/CodeBlock";
import { copyToClipboard } from "../../utils/clipboard";
import styles from "./ChatMessage.module.css";

// Fenced code blocks (```js ... ```) get syntax highlighting and a copy button.
const markdownComponents = {
  pre({ node }) {
    const codeNode = node?.children?.[0];
    const classes = codeNode?.properties?.className ?? [];
    const language = classes.find((c) => String(c).startsWith("language-"))?.slice(9);
    const value = (codeNode?.children ?? [])
      .map((child) => child.value ?? "")
      .join("")
      .replace(/\n$/, "");
    return <CodeBlock language={language} value={value} />;
  },
  // Code blocks are handled by "pre" above, so this only receives `inline code`.
  code({ children }) {
    return <code className={styles.inlineCode}>{children}</code>;
  },
  a({ href, children }) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  },
  table({ children }) {
    return (
      <div className={styles.tableWrap}>
        <table>{children}</table>
      </div>
    );
  },
};

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={styles.actionBtn}
      onClick={async () => {
        if (await copyToClipboard(text)) {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      }}
      aria-label={copied ? "Copied" : "Copy message"}
      title={copied ? "Copied" : "Copy"}
    >
      {copied ? <Check size={16} /> : <Copy size={16} />}
    </button>
  );
}

function ChatMessage({ message }) {
  const { role, content, isStreaming, error } = message;

  if (role === "user") {
    return (
      <div className={`${styles.row} ${styles.userRow}`}>
        <div className={styles.userBubble}>{content}</div>
        <div className={`${styles.actions} ${styles.userActions}`}>
          <CopyButton text={content} />
        </div>
      </div>
    );
  }

  const isThinking = isStreaming && !content;

  return (
    <div className={`${styles.row} ${styles.assistantRow}`}>
      {isThinking ? (
        <div className={styles.thinking} aria-label="Thinking">
          <span />
        </div>
      ) : (
        content && (
          <div className={`${styles.markdown} ${isStreaming ? styles.streaming : ""}`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {content}
            </ReactMarkdown>
          </div>
        )
      )}

      {error && (
        <div className={styles.error} role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {!isStreaming && content && (
        <div className={styles.actions}>
          <CopyButton text={content} />
        </div>
      )}
    </div>
  );
}

// Only the message that is currently streaming re-renders on each new chunk.
export default memo(ChatMessage);
