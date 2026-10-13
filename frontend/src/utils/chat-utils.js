// Groups chats into "Today", "Yesterday", "Previous 7 days", ... like ChatGPT.
export function groupChatsByDate(chats, now = new Date()) {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const DAY = 24 * 60 * 60 * 1000;
  const groups = new Map();

  for (const chat of chats) {
    const time = new Date(chat.updatedAt ?? chat.createdAt).getTime();
    let label;
    if (Number.isNaN(time) || time >= startOfToday) label = "Today";
    else if (time >= startOfToday - DAY) label = "Yesterday";
    else if (time >= startOfToday - 7 * DAY) label = "Previous 7 days";
    else if (time >= startOfToday - 30 * DAY) label = "Previous 30 days";
    else {
      label = new Date(time).toLocaleDateString(undefined, { month: "long", year: "numeric" });
    }

    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(chat);
  }

  return [...groups].map(([label, items]) => ({ label, items }));
}

export const getInitials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";

// URL helpers: "/" is a new chat, "/c/12" is chat 12.
export const readChatIdFromUrl = () => {
  const match = window.location.pathname.match(/^\/c\/(\d+)\/?$/);
  return match ? Number(match[1]) : null;
};

export const writeChatIdToUrl = (chatId, { replace = false } = {}) => {
  const path = chatId ? `/c/${chatId}` : "/";
  if (window.location.pathname === path) return;
  window.history[replace ? "replaceState" : "pushState"]({ chatId }, "", path);
};
