import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import { api, streamMessage } from "../../api/client";
import { useAuth } from "../../context/useAuth";
import { readChatIdFromUrl, writeChatIdToUrl } from "../../utils/chat-utils";
import Sidebar from "../../components/Sidebar/Sidebar";
import ChatHeader from "../../components/ChatHeader/ChatHeader";
import MessageList from "../../components/MessageList/MessageList";
import ChatInput from "../../components/ChatInput/ChatInput";
import ConfirmDialog from "../../components/ConfirmDialog/ConfirmDialog";
import styles from "./ChatPage.module.css";

const isMobile = () => window.matchMedia("(max-width: 768px)").matches;

export default function ChatPage() {
  const { user, logout } = useAuth();

  const [chats, setChats] = useState([]);
  const [isLoadingChats, setIsLoadingChats] = useState(true);
  const [activeChatId, setActiveChatId] = useState(readChatIdFromUrl);
  const [messages, setMessages] = useState([]);
  const [isLoadingChat, setIsLoadingChat] = useState(() => readChatIdFromUrl() !== null);
  const [chatError, setChatError] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => !isMobile());
  const [chatToDelete, setChatToDelete] = useState(null);
  const [notice, setNotice] = useState("");

  const streamAbortRef = useRef(null);
  const loadAbortRef = useRef(null);

  const activeChat = chats.find((chat) => chat.id === activeChatId);

  // ---------- data loading ----------

  const loadChats = useCallback(async (signal) => {
    try {
      const data = await api.listChats({ signal });
      setChats(data.chats);
    } catch (error) {
      if (error.name !== "AbortError") setNotice(error.message);
    } finally {
      if (!signal?.aborted) setIsLoadingChats(false);
    }
  }, []);

  const loadMessages = useCallback(async (chatId) => {
    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;

    try {
      const data = await api.getChat(chatId, { signal: controller.signal });
      setMessages(data.messages);
    } catch (error) {
      if (error.name === "AbortError") return;
      setChatError(
        error.status === 404 ? "This chat doesn't exist or was deleted." : error.message,
      );
    } finally {
      if (!controller.signal.aborted) setIsLoadingChat(false);
    }
  }, []);

  // Initial load: chat list + the chat in the URL (if any)
  useEffect(() => {
    const controller = new AbortController();
    loadChats(controller.signal);

    const chatId = readChatIdFromUrl();
    if (chatId) loadMessages(chatId);

    return () => {
      controller.abort();
      loadAbortRef.current?.abort();
      streamAbortRef.current?.abort();
    };
  }, [loadChats, loadMessages]);

  // ---------- navigation ----------

  const stopStreaming = () => {
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
  };

  const openChat = (chatId, { updateUrl = true } = {}) => {
    if (isMobile()) setSidebarOpen(false);
    if (chatId === activeChatId && !chatError) return;

    stopStreaming();
    loadAbortRef.current?.abort();
    if (updateUrl) writeChatIdToUrl(chatId);

    setActiveChatId(chatId);
    setMessages([]);
    setChatError("");
    setIsLoadingChat(chatId !== null);
    if (chatId !== null) loadMessages(chatId);
  };

  const startNewChat = () => openChat(null);

  // Browser back/forward buttons
  const onPopState = useEffectEvent(() => openChat(readChatIdFromUrl(), { updateUrl: false }));
  // Ctrl/Cmd + Shift + O starts a new chat, like ChatGPT
  const onKeyDown = useEffectEvent((event) => {
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "o") {
      event.preventDefault();
      startNewChat();
    }
  });

  useEffect(() => {
    const handlePop = () => onPopState();
    const handleKey = (event) => onKeyDown(event);
    window.addEventListener("popstate", handlePop);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("popstate", handlePop);
      window.removeEventListener("keydown", handleKey);
    };
  }, []);

  useEffect(() => {
    document.title = activeChat ? `${activeChat.title} | ChatGPT Clone` : "ChatGPT Clone";
  }, [activeChat]);

  // Auto-hide notices
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  // ---------- sending ----------

  const sendMessage = async (question) => {
    if (isStreaming) return;

    const stamp = Date.now();
    const tempUserId = `temp-user-${stamp}`;
    let streamingId = `temp-assistant-${stamp}`;
    let receivedMeta = false;

    // Capture the id now: React runs state updaters later, after streamingId may have changed.
    const updateStreamingMessage = (update) => {
      const targetId = streamingId;
      setMessages((prev) => prev.map((m) => (m.id === targetId ? update(m) : m)));
    };

    setChatError("");
    setMessages((prev) => [
      ...prev,
      { id: tempUserId, role: "user", content: question },
      { id: streamingId, role: "assistant", content: "", isStreaming: true },
    ]);
    setIsStreaming(true);

    const controller = new AbortController();
    streamAbortRef.current = controller;

    const handleEvent = (type, data) => {
      switch (type) {
        case "meta": {
          receivedMeta = true;
          setMessages((prev) => prev.map((m) => (m.id === tempUserId ? data.userMessage : m)));
          const chat = { ...data.chat, updatedAt: new Date().toISOString() };
          setChats((prev) => [chat, ...prev.filter((c) => c.id !== chat.id)]);
          if (data.isNewChat) {
            setActiveChatId(chat.id);
            writeChatIdToUrl(chat.id);
          }
          break;
        }
        case "delta":
          updateStreamingMessage((m) => ({ ...m, content: m.content + data.text }));
          break;
        case "done": {
          const tempId = streamingId;
          setMessages((prev) => prev.map((m) => (m.id === tempId ? data.assistantMessage : m)));
          streamingId = data.assistantMessage.id;
          setIsStreaming(false);
          break;
        }
        case "title":
          setChats((prev) =>
            prev.map((c) => (c.id === data.chatId ? { ...c, title: data.title } : c)),
          );
          break;
        case "error":
          updateStreamingMessage((m) => ({ ...m, isStreaming: false, error: data.message }));
          break;
        default:
          break;
      }
    };

    try {
      await streamMessage(
        { chatId: activeChatId, question },
        { signal: controller.signal, onEvent: handleEvent },
      );
    } catch (error) {
      if (error.name === "AbortError") {
        // Stopped by the user: keep the partial answer, drop it if nothing arrived yet.
        const targetId = streamingId;
        setMessages((prev) =>
          prev.filter((m) => !(m.id === targetId && !m.content.trim() && !m.error)),
        );
        // A new chat may have been created on the server before we stopped.
        if (!receivedMeta) loadChats();
      } else if (error.status !== 401) {
        updateStreamingMessage((m) => ({ ...m, isStreaming: false, error: error.message }));
      }
    } finally {
      updateStreamingMessage((m) => (m.isStreaming ? { ...m, isStreaming: false } : m));
      if (streamAbortRef.current === controller) streamAbortRef.current = null;
      setIsStreaming(false);
    }
  };

  // ---------- chat management ----------

  const renameChat = async (chatId, title) => {
    const previous = chats;
    setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, title } : c)));
    try {
      const data = await api.renameChat(chatId, title);
      setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, title: data.chat.title } : c)));
    } catch (error) {
      setChats(previous);
      setNotice(error.message);
    }
  };

  const confirmDelete = async () => {
    const chat = chatToDelete;
    setChatToDelete(null);
    if (!chat) return;

    try {
      await api.deleteChat(chat.id);
      setChats((prev) => prev.filter((c) => c.id !== chat.id));
      if (chat.id === activeChatId) openChat(null);
    } catch (error) {
      setNotice(error.message);
    }
  };

  // ---------- render ----------

  const showWelcome = activeChatId === null && messages.length === 0;
  const firstName = user?.name?.split(" ")[0];

  return (
    <div className={styles.app}>
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((open) => !open)}
        chats={chats}
        isLoading={isLoadingChats}
        activeChatId={activeChatId}
        onSelectChat={openChat}
        onNewChat={startNewChat}
        onRenameChat={renameChat}
        onDeleteChat={setChatToDelete}
        user={user}
        onLogout={logout}
      />
      {sidebarOpen && (
        <div className={styles.backdrop} onClick={() => setSidebarOpen(false)} aria-hidden="true" />
      )}

      <main className={styles.main}>
        <ChatHeader
          sidebarOpen={sidebarOpen}
          onOpenSidebar={() => setSidebarOpen(true)}
          onNewChat={startNewChat}
        />

        {showWelcome ? (
          <div className={styles.welcome}>
            <h1 className={styles.greeting}>
              {firstName ? `What can I help with, ${firstName}?` : "What can I help with?"}
            </h1>
            <ChatInput onSend={sendMessage} onStop={stopStreaming} isStreaming={isStreaming} />
          </div>
        ) : (
          <>
            <MessageList
              chatKey={activeChatId}
              messages={messages}
              isLoading={isLoadingChat}
              error={chatError}
              onNewChat={startNewChat}
            />
            {!chatError && (
              <ChatInput
                onSend={sendMessage}
                onStop={stopStreaming}
                isStreaming={isStreaming}
                disabled={isLoadingChat}
              />
            )}
          </>
        )}
      </main>

      {chatToDelete && (
        <ConfirmDialog
          title="Delete chat?"
          confirmLabel="Delete"
          onConfirm={confirmDelete}
          onCancel={() => setChatToDelete(null)}
        >
          This will delete <strong>{chatToDelete.title}</strong>. This can't be undone.
        </ConfirmDialog>
      )}

      {notice && (
        <div className={styles.notice} role="status">
          {notice}
        </div>
      )}
    </div>
  );
}
