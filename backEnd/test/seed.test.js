import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { DEMO_USERS, chatStartTime, parseSeedChats, seedDemoData } from "../schema/seed.js";
import { startServer } from "./support/server.js";

const PASSWORD = "Demo1234!";
let api;

before(async () => {
  api = await startServer();
});
after(() => api.close());

const loginAs = async (email) => {
  const res = await api.request("POST", "/auth/login", { body: { email, password: PASSWORD } });
  assert.equal(res.status, 200, `can log in as ${email}`);
  return res.body.data.token;
};

describe("seed-data.md", () => {
  const chats = parseSeedChats();

  it("contains chats spread over every sidebar group", () => {
    assert.ok(chats.length >= 8);
    const days = chats.map((chat) => chat.daysAgo);
    assert.ok(days.includes(0), "Today");
    assert.ok(days.includes(1), "Yesterday");
    assert.ok(days.some((d) => d >= 2 && d <= 7), "Previous 7 days");
    assert.ok(days.some((d) => d >= 8 && d <= 30), "Previous 30 days");
    assert.ok(days.some((d) => d > 30), "older");
  });

  it("has alternating user/assistant messages with content", () => {
    for (const chat of chats) {
      assert.ok(chat.title, "every chat has a title");
      chat.messages.forEach((message, i) => {
        assert.equal(message.role, i % 2 === 0 ? "user" : "assistant", chat.title);
        assert.ok(message.content.length > 0, `${chat.title} message ${i} is empty`);
      });
      assert.equal(chat.messages.at(-1).role, "assistant", `${chat.title} ends with an answer`);
    }
  });

  it("rejects a file where a chat starts with the assistant", () => {
    assert.throws(() => parseSeedChats("@@@ chat | Bad | 0 | 0\n@@@ assistant\nHi"), /must start/);
  });
});

describe("chatStartTime", () => {
  const chats = parseSeedChats();
  const dayDifference = (from, to) => {
    const startOf = (time) => {
      const d = new Date(time);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    };
    return Math.round((startOf(from) - startOf(to)) / (24 * 60 * 60 * 1000));
  };

  // Seeding just after midnight, early morning, afternoon and just before midnight.
  for (const [hours, minutes] of [[0, 5], [3, 0], [14, 30], [23, 58]]) {
    it(`keeps every chat on its day when seeding at ${hours}:${String(minutes).padStart(2, "0")}`, () => {
      const now = new Date(2026, 9, 13, hours, minutes).getTime();
      let previousStart = Infinity;

      chats.forEach((chat, positionInFile) => {
        const start = chatStartTime(chat, { now, positionInFile, chatCount: chats.length });
        const end = start + (chat.messages.length - 1) * 50 * 1000;

        assert.equal(dayDifference(now, start), chat.daysAgo, `${chat.title} starts on its day`);
        assert.equal(dayDifference(now, end), chat.daysAgo, `${chat.title} ends on its day`);
        assert.ok(end <= now + 30 * 60 * 1000, `${chat.title} is not far in the future`);
        assert.ok(start < previousStart, `${chat.title} keeps the file order`);
        previousStart = start;
      });
    });
  }
});

describe("seedDemoData", () => {
  let firstRun;

  before(async () => {
    firstRun = await seedDemoData({ password: PASSWORD });
  });

  it("creates every demo user, who can log in", async () => {
    assert.deepEqual(
      firstRun.map((user) => user.email),
      DEMO_USERS.map((user) => user.email),
    );
    for (const user of DEMO_USERS) await loginAs(user.email);
  });

  it("gives the main demo user all chats, newest first, with their messages", async () => {
    const token = await loginAs("hana@example.com");
    const { chats } = (await api.request("GET", "/chats", { token })).body.data;
    const expected = parseSeedChats()
      .slice()
      .sort((a, b) => a.daysAgo * 24 + a.hoursAgo - (b.daysAgo * 24 + b.hoursAgo));

    assert.deepEqual(
      chats.map((chat) => chat.title),
      expected.map((chat) => chat.title),
    );

    const first = await api.request("GET", `/chats/${chats[0].id}`, { token });
    assert.equal(first.body.data.messages.length, expected[0].messages.length);
    assert.equal(first.body.data.messages[0].content, expected[0].messages[0].content);
  });

  it("can run again without duplicating anything", async () => {
    await seedDemoData({ password: PASSWORD });
    const token = await loginAs("hana@example.com");
    const { chats } = (await api.request("GET", "/chats", { token })).body.data;
    assert.equal(chats.length, parseSeedChats().length);
  });

  it("never touches other users", async () => {
    const res = await api.request("POST", "/auth/register", {
      body: { name: "Real User", email: "real@person.com", password: "password123" },
    });
    const token = res.body.data.token;
    await api.stream({ question: "my own chat" }, token);

    await seedDemoData({ password: PASSWORD });
    const { chats } = (await api.request("GET", "/chats", { token })).body.data;
    assert.equal(chats.length, 1);
  });
});
