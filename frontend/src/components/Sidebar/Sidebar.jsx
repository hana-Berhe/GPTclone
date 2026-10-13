import { useEffect, useMemo, useRef, useState } from "react";
import { Ellipsis, LogOut, PanelLeft, Pencil, Search, SquarePen, Trash2, X } from "lucide-react";
import { getInitials, groupChatsByDate } from "../../utils/chat-utils";
import styles from "./Sidebar.module.css";

// Closes a popup menu when clicking outside of it or pressing Escape.
function useDismiss(isOpen, ref, onDismiss) {
  useEffect(() => {
    if (!isOpen) return;
    const onPointer = (event) => {
      if (!ref.current?.contains(event.target)) onDismiss();
    };
    const onKey = (event) => event.key === "Escape" && onDismiss();
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen, ref, onDismiss]);
}

function ChatItem({ chat, isActive, onSelect, onRename, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(chat.title);
  const menuRef = useRef(null);
  const closeMenu = useMemo(() => () => setMenuOpen(false), []);
  useDismiss(menuOpen, menuRef, closeMenu);

  const startEditing = () => {
    setDraft(chat.title);
    setIsEditing(true);
    setMenuOpen(false);
  };

  const finishEditing = (save) => {
    setIsEditing(false);
    const title = draft.replace(/\s+/g, " ").trim();
    if (save && title && title !== chat.title) onRename(chat.id, title);
  };

  if (isEditing) {
    return (
      <li className={`${styles.chatItem} ${styles.active}`}>
        <input
          className={styles.renameInput}
          value={draft}
          maxLength={80}
          autoFocus
          onFocus={(e) => e.target.select()}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => finishEditing(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") finishEditing(true);
            if (e.key === "Escape") finishEditing(false);
          }}
          aria-label="Chat title"
        />
      </li>
    );
  }

  return (
    <li
      className={`${styles.chatItem} ${isActive ? styles.active : ""} ${menuOpen ? styles.menuOpen : ""}`}
    >
      <button
        type="button"
        className={styles.chatLink}
        onClick={() => onSelect(chat.id)}
        onDoubleClick={startEditing}
        title={chat.title}
        aria-current={isActive ? "page" : undefined}
      >
        {chat.title}
      </button>

      <div className={styles.menuWrap} ref={menuRef}>
        <button
          type="button"
          className={styles.moreBtn}
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={`Options for ${chat.title}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <Ellipsis size={18} />
        </button>

        {menuOpen && (
          <div className={styles.menu} role="menu">
            <button type="button" role="menuitem" onClick={startEditing}>
              <Pencil size={16} /> Rename
            </button>
            <button
              type="button"
              role="menuitem"
              className={styles.danger}
              onClick={() => {
                setMenuOpen(false);
                onDelete(chat);
              }}
            >
              <Trash2 size={16} /> Delete
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

export default function Sidebar({
  isOpen,
  onToggle,
  chats,
  isLoading,
  activeChatId,
  onSelectChat,
  onNewChat,
  onRenameChat,
  onDeleteChat,
  user,
  onLogout,
}) {
  const [isSearching, setIsSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const closeUserMenu = useMemo(() => () => setUserMenuOpen(false), []);
  useDismiss(userMenuOpen, userMenuRef, closeUserMenu);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? chats.filter((chat) => chat.title.toLowerCase().includes(q)) : chats;
  }, [chats, query]);

  const groups = useMemo(() => groupChatsByDate(filtered), [filtered]);

  const closeSearch = () => {
    setIsSearching(false);
    setQuery("");
  };

  return (
    <aside
      className={`${styles.sidebar} ${isOpen ? styles.open : styles.closed}`}
      aria-label="Chat history"
    >
      <div className={styles.inner}>
        <div className={styles.header}>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={onToggle}
            aria-label="Close sidebar"
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

        <nav className={styles.nav}>
          <button type="button" className={styles.item} onClick={onNewChat}>
            <SquarePen size={18} />
            <span>New chat</span>
            <kbd className={styles.shortcut}>Ctrl+Shift+O</kbd>
          </button>

          {isSearching ? (
            <div className={styles.searchBox}>
              <Search size={18} />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && closeSearch()}
                placeholder="Search chats…"
                aria-label="Search chats"
              />
              <button type="button" onClick={closeSearch} aria-label="Close search">
                <X size={16} />
              </button>
            </div>
          ) : (
            <button type="button" className={styles.item} onClick={() => setIsSearching(true)}>
              <Search size={18} />
              <span>Search chats</span>
            </button>
          )}
        </nav>

        <div className={styles.history}>
          {isLoading ? (
            <ul className={styles.skeleton} aria-label="Loading chats">
              {[70, 55, 80, 45, 65].map((w) => (
                <li key={w} style={{ width: `${w}%` }} />
              ))}
            </ul>
          ) : groups.length === 0 ? (
            <p className={styles.emptyHistory}>
              {query ? "No chats match your search." : "Your chats will show up here."}
            </p>
          ) : (
            groups.map((group) => (
              <section key={group.label} className={styles.group}>
                <h2 className={styles.groupLabel}>{group.label}</h2>
                <ul>
                  {group.items.map((chat) => (
                    <ChatItem
                      key={chat.id}
                      chat={chat}
                      isActive={chat.id === activeChatId}
                      onSelect={onSelectChat}
                      onRename={onRenameChat}
                      onDelete={onDeleteChat}
                    />
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>

        <div className={styles.footer} ref={userMenuRef}>
          {userMenuOpen && (
            <div className={`${styles.menu} ${styles.userMenu}`} role="menu">
              <div className={styles.userEmail}>{user?.email}</div>
              <button type="button" role="menuitem" onClick={onLogout}>
                <LogOut size={16} /> Log out
              </button>
            </div>
          )}
          <button
            type="button"
            className={styles.user}
            onClick={() => setUserMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={userMenuOpen}
          >
            <span className={styles.avatar}>{getInitials(user?.name)}</span>
            <span className={styles.userInfo}>
              <span className={styles.userName}>{user?.name}</span>
              <span className={styles.userPlan}>Free</span>
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
}
