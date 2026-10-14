import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

// Low limits so they're easy to hit. Set before the app is imported.
Object.assign(process.env, {
  RATE_LIMIT_AUTH_PER_15_MIN: "3",
  RATE_LIMIT_MESSAGES_PER_MIN: "2",
  TRUST_PROXY: "1",
});

let api;
before(async () => {
  const { startServer } = await import("./support/server.js");
  api = await startServer();
});
after(() => api.close());

const post = (path, body, headers = {}) =>
  fetch(api.baseUrl + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

const login = (ip) =>
  post(
    "/auth/login",
    { email: "nobody@example.com", password: "password123" },
    { "X-Forwarded-For": ip },
  );

describe("security headers", () => {
  it("are sent on every response", async () => {
    const res = await fetch(`${api.baseUrl}/health`);
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    assert.equal(res.headers.get("x-frame-options"), "DENY");
    assert.match(res.headers.get("content-security-policy"), /frame-ancestors 'none'/);
    assert.equal(res.headers.get("x-powered-by"), null);
  });

  it("only send HSTS in production", async () => {
    const res = await fetch(`${api.baseUrl}/health`);
    assert.equal(res.headers.get("strict-transport-security"), null);
  });
});

describe("rate limiting", () => {
  it("blocks login attempts after the limit, per visitor IP", async () => {
    for (let i = 0; i < 3; i++) {
      assert.equal((await login("203.0.113.1")).status, 401);
    }
    const blocked = await login("203.0.113.1");
    assert.equal(blocked.status, 429);
    assert.ok(Number(blocked.headers.get("retry-after")) > 0);
    assert.match((await blocked.json()).message, /Too many attempts/);

    // Another visitor (different IP behind the proxy) is not affected.
    assert.equal((await login("203.0.113.2")).status, 401);
  });

  it("limits how fast one account can send messages", async () => {
    const signUp = async (ip) => {
      const res = await post(
        "/auth/register",
        { name: "Limit", email: `limit${ip}${Date.now()}@example.com`, password: "password123" },
        { "X-Forwarded-For": ip },
      );
      return (await res.json()).data.token;
    };
    const send = (token) =>
      post("/chats/stream", { question: "hi" }, { Authorization: `Bearer ${token}` }).then(
        async (res) => {
          await res.arrayBuffer(); // finish reading the stream
          return res.status;
        },
      );

    const token = await signUp("198.51.100.1");
    assert.equal(await send(token), 200);
    assert.equal(await send(token), 200);
    assert.equal(await send(token), 429);

    // A different account still can send.
    const other = await signUp("198.51.100.2");
    assert.equal(await send(other), 200);
  });
});
