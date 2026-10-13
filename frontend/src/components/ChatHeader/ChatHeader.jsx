import { PanelLeft, SquarePen } from "lucide-react";
import styles from "./ChatHeader.module.css";

export default function ChatHeader({ sidebarOpen, onOpenSidebar, onNewChat }) {
  return (
    <header className={`${styles.header} ${sidebarOpen ? styles.sidebarOpen : ""}`}>
      <div className={styles.left}>
        <div className={styles.sidebarControls}>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={onOpenSidebar}
            aria-label="Open sidebar"
          >
            <PanelLeft size={20} />
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={onNewChat}
            aria-label="New chat"
          >
            <SquarePen size={20} />
          </button>
        </div>
        <span className={styles.title}>ChatGPT Clone</span>
      </div>
    </header>
  );
}
