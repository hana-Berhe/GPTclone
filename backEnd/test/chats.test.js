import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { geminiCalls } from "./support/fake-gemini.js";
import { startServer, uniqueEmail } from "./support/server.js";

let api;
let token;
let otherToken;

const signUp = async (name) =>
  (
    await api.request("POST", "/auth/register", {
      body: { name, email: uniqueEmail(), password: "password123" },
    })
  ).body.data.token;

const eventTypes = (events) => events.map((event) => event.type);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

before(async () => {
  api = await startServer();
  token = await signUp("Owner");
  otherToken = await signUp("Other");
});
after(() => api.close());

describe("authentication", () => {
  it("requires a token for every chat route", async () => {
    assert.equal((await api.request("GET", "/chats")).status, 401);
    assert.equal((await api.request("GET", "/chats/1")).status, 401);
    assert.equal(
      (await api.request("POST", "/chats/stream", { body: { question: "hi" } })).status,
      401,
    );
  });
});

describe("POST /api/chats/stream - validation", () => {
  it("rejects a missing, empty or whitespace-only question", async () => {
    for (const body of [{}, { question: "" }, { question: "   \n " }, { question: 42 }]) {
      const res = await api.stream(body, token);
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.equal(res.body.errors.question, "Message cannot be empty.");
    }
  });

  it("rejects a question over 20,000 characters", async () => {
    const res = await api.stream({ question: "a".repeat(20001) }, token);
    assert.equal(res.status, 400);
    assert.match(res.body.errors.question, /too long/);
  });

  it("rejects an invalid chatId", async () => {
    for (const chatId of ["abc", "", 0, -1, 1.5, "1; DROP TABLE chats"]) {
      const res = await api.stream({ chatId, question: "hi" }, token);
      assert.equal(res.status, 400, JSON.stringify(chatId));
      assert.equal(res.body.errors.chatId, "Invalid chat id.");
    }
  });

  it("returns 404 for a chat that does not exist", async () => {
    const res = await api.stream({ chatId: 999999, question: "hi" }, token);
    assert.equal(res.status, 404);
  });
});

describe("POST /api/chats/stream - conversation", () => {
  let chatId;

  it("starts a new chat when chatId is null, streaming events in order", async () => {
    const res = await api.stream({ chatId: null, question: "  What is React?  " }, token);
    assert.equal(res.status, 200);
    assert.deepEqual(
      eventTypes(res.events).filter((t) => t !== "delta"),
      ["meta", "done", "title"],
    );

    const meta = res.events[0].data;
    assert.equal(meta.isNewChat, true);
    assert.equal(meta.userMessage.content, "What is React?", "question is trimmed");
    chatId = meta.chat.id;

    const streamed = res.events
      .filter((e) => e.type === "delta")
      .map((e) => e.data.text)
      .join("");
    const done = res.events.find((e) => e.type === "done").data.assistantMessage;
    assert.equal(done.content, streamed);
    assert.equal(done.tokenCount, 42);
    assert.equal(res.events.at(-1).data.title, "Title: What is React?");
  });

  it("continues an existing chat and sends earlier messages as context", async () => {
    const res = await api.stream({ chatId, question: "Tell me more" }, token);
    assert.equal(res.events[0].data.isNewChat, false);
    assert.equal(eventTypes(res.events).includes("title"), false);

    const lastCall = geminiCalls.at(-1);
    assert.deepEqual(
      lastCall.map((c) => c.role),
      ["user", "model", "user"],
    );
    assert.equal(lastCall.at(-1).parts[0].text, "Tell me more");
  });

  it("accepts a numeric string chatId", async () => {
    const res = await api.stream({ chatId: String(chatId), question: "String id" }, token);
    assert.equal(res.status, 200);
    assert.equal(res.events[0].data.chat.id, chatId);
  });

  it("returns a friendly error event when Gemini is rate-limited", async () => {
    const res = await api.stream({ chatId, question: "FAIL429" }, token);
    assert.equal(res.events.at(-1).type, "error");
    assert.match(res.events.at(-1).data.message, /busy/);
  });

  it("returns an error event when the model sends no text", async () => {
    const res = await api.stream({ chatId, question: "EMPTY" }, token);
    assert.equal(res.events.at(-1).type, "error");
    assert.match(res.events.at(-1).data.message, /empty response/);
  });

  it("recovers after failed turns (history stays valid for Gemini)", async () => {
    const res = await api.stream({ chatId, question: "Still there?" }, token);
    assert.ok(eventTypes(res.events).includes("done"));

    const roles = geminiCalls.at(-1).map((c) => c.role);
    assert.equal(roles[0], "user");
    roles.forEach((role, i) => i > 0 && assert.notEqual(role, roles[i - 1]));
  });

  it("saves the partial answer when the user presses Stop", async () => {
    const res = await api.stream({ question: "SLOW please write a long answer" }, token, {
      stopAfterDeltas: 2,
    });
    const newChatId = res.events[0].data.chat.id;
    await wait(500);

    const chat = await api.request("GET", `/chats/${newChatId}`, { token });
    const [question, answer] = chat.body.data.messages;
    assert.equal(question.role, "user");
    assert.equal(answer.role, "assistant");
    assert.ok(answer.content.length > 0, "partial text was saved");
    assert.ok(!answer.content.includes("answer"), "the rest of the answer was not generated");
  });
});

describe("chat management", () => {
  let chatId;

  before(async () => {
    const res = await api.stream({ question: "Chat to manage" }, token);
    chatId = res.events[0].data.chat.id;
  });

  it("lists only the user's own chats", async () => {
    const mine = await api.request("GET", "/chats", { token });
    const theirs = await api.request("GET", "/chats", { token: otherToken });
    assert.ok(mine.body.data.chats.some((chat) => chat.id === chatId));
    assert.equal(theirs.body.data.chats.length, 0);
  });

  it("validates the chat id in the URL", async () => {
    for (const id of ["abc", "0", "-5", "1.5"]) {
      const res = await api.request("GET", `/chats/${id}`, { token });
      assert.equal(res.status, 400, id);
      assert.equal(res.body.errors.chatId, "Invalid chat id.");
    }
  });

  it("validates the new title", async () => {
    let res = await api.request("PATCH", `/chats/${chatId}`, { token, body: { title: "   " } });
    assert.equal(res.status, 400);
    assert.equal(res.body.errors.title, "Title cannot be empty.");

    res = await api.request("PATCH", `/chats/${chatId}`, {
      token,
      body: { title: "x".repeat(81) },
    });
    assert.equal(res.status, 400);

    res = await api.request("PATCH", `/chats/${chatId}`, { token, body: {} });
    assert.equal(res.status, 400);
  });

  it("renames a chat, collapsing extra spaces", async () => {
    const res = await api.request("PATCH", `/chats/${chatId}`, {
      token,
      body: { title: "  My   renamed\n chat " },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.chat.title, "My renamed chat");
  });

  it("hides chats from other users (read, rename, delete, send)", async () => {
    const as = { token: otherToken };
    assert.equal((await api.request("GET", `/chats/${chatId}`, as)).status, 404);
    assert.equal(
      (await api.request("PATCH", `/chats/${chatId}`, { ...as, body: { title: "x" } })).status,
      404,
    );
    assert.equal((await api.request("DELETE", `/chats/${chatId}`, as)).status, 404);
    assert.equal((await api.stream({ chatId, question: "hi" }, otherToken)).status, 404);
  });

  it("deletes a chat and its messages", async () => {
    assert.equal((await api.request("DELETE", `/chats/${chatId}`, { token })).status, 200);
    assert.equal((await api.request("GET", `/chats/${chatId}`, { token })).status, 404);
    assert.equal((await api.request("DELETE", `/chats/${chatId}`, { token })).status, 404);
  });
});

describe("other routes", () => {
  it("responds to the health check", async () => {
    assert.equal((await api.request("GET", "/health")).status, 200);
  });

  it("returns JSON 404 for unknown API routes", async () => {
    const res = await api.request("GET", "/does-not-exist");
    assert.equal(res.status, 404);
    assert.equal(res.body.status, "error");
  });
});
