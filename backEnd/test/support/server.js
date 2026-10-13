import { createApp } from "../../src/app.js";

// Starts the real Express app on a random free port.
export async function startServer() {
  const app = createApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;

  const request = async (method, path, { body, token, raw } = {}) => {
    const response = await fetch(baseUrl + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
    });
    const json = await response.json().catch(() => null);
    return { status: response.status, body: json };
  };

  // Sends a message and collects the Server-Sent Events.
  // stopAfterDeltas: abort the request after that many text chunks (simulates "Stop").
  const stream = async (body, token, { stopAfterDeltas } = {}) => {
    const controller = new AbortController();
    const response = await fetch(`${baseUrl}/chats/stream`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });

    if (!response.headers.get("content-type")?.includes("text/event-stream")) {
      return { status: response.status, body: await response.json(), events: [] };
    }

    const events = [];
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let boundary;
        while ((boundary = buffer.indexOf("\n\n")) !== -1) {
          const block = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const type = /^event: (.*)$/m.exec(block)[1];
          const data = JSON.parse(/^data: (.*)$/m.exec(block)[1]);
          events.push({ type, data });
          const deltas = events.filter((e) => e.type === "delta").length;
          if (stopAfterDeltas && deltas >= stopAfterDeltas) controller.abort();
        }
      }
    } catch (error) {
      if (error.name !== "AbortError") throw error;
    }
    return { status: response.status, events };
  };

  return { request, stream, close: () => new Promise((resolve) => server.close(resolve)) };
}

let counter = 0;
export const uniqueEmail = (prefix = "user") => `${prefix}${Date.now()}${counter++}@example.com`;
