// All communication with the backend lives here.
const API_BASE_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
const TOKEN_KEY = "chatgpt-clone-token";

export class ApiError extends Error {
  /**
   * @param {number} status HTTP status (0 when the server can't be reached)
   * @param {string} message Message that can be shown to the user
   * @param {Record<string, string>} [fieldErrors] Validation messages per field, e.g. { email: "..." }
   */
  constructor(status, message, fieldErrors = {}) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

// AuthProvider registers a callback so any 401 logs the user out.
let onUnauthorized = () => {};
export const setUnauthorizedHandler = (handler) => {
  onUnauthorized = handler;
};

const buildHeaders = () => {
  const headers = { "Content-Type": "application/json" };
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const toApiError = async (response) => {
  const body = await response.json().catch(() => null);
  const message =
    body?.message ||
    (response.status >= 500
      ? "The server had a problem. Please try again."
      : `Request failed (${response.status}).`);
  if (response.status === 401) onUnauthorized();
  return new ApiError(response.status, message, body?.errors ?? {});
};

async function request(method, path, body, { signal } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: buildHeaders(),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new ApiError(0, "Can't reach the server. Is the backend running?");
  }

  if (!response.ok) throw await toApiError(response);
  const json = await response.json();
  return json.data;
}

export const api = {
  register: (payload) => request("POST", "/auth/register", payload),
  login: (payload) => request("POST", "/auth/login", payload),
  me: (opts) => request("GET", "/auth/me", undefined, opts),

  listChats: (opts) => request("GET", "/chats", undefined, opts),
  getChat: (chatId, opts) => request("GET", `/chats/${chatId}`, undefined, opts),
  renameChat: (chatId, title) => request("PATCH", `/chats/${chatId}`, { title }),
  deleteChat: (chatId) => request("DELETE", `/chats/${chatId}`),
};

/**
 * Sends a message and reads the Server-Sent Events stream.
 * onEvent(type, data) is called for: meta, delta, done, title, error.
 */
export async function streamMessage({ chatId, question }, { signal, onEvent }) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/chats/stream`, {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify({ chatId: chatId ?? null, question }),
      signal,
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new ApiError(0, "Can't reach the server. Is the backend running?");
  }

  if (!response.ok) throw await toApiError(response);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const dispatch = (block) => {
    let type = "message";
    const dataLines = [];
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) type = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
    }
    if (!dataLines.length) return;
    try {
      onEvent(type, JSON.parse(dataLines.join("\n")));
    } catch (error) {
      console.error("Bad stream event", error);
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

    let boundary;
    while ((boundary = buffer.indexOf("\n\n")) !== -1) {
      dispatch(buffer.slice(0, boundary));
      buffer = buffer.slice(boundary + 2);
    }
  }
  if (buffer.trim()) dispatch(buffer);
}
