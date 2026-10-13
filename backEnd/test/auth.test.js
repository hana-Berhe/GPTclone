import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { startServer, uniqueEmail } from "./support/server.js";

let api;
before(async () => {
  api = await startServer();
});
after(() => api.close());

const register = (body) => api.request("POST", "/auth/register", { body });
const login = (body) => api.request("POST", "/auth/login", { body });

describe("POST /api/auth/register - validation", () => {
  it("reports every missing field at once", async () => {
    const res = await register({});
    assert.equal(res.status, 400);
    assert.deepEqual(Object.keys(res.body.errors).sort(), ["email", "name", "password"]);
    assert.equal(res.body.message, res.body.errors.name);
  });

  it("rejects a name that is only spaces", async () => {
    const res = await register({ name: "   ", email: uniqueEmail(), password: "password123" });
    assert.equal(res.status, 400);
    assert.equal(res.body.errors.name, "Please enter your name.");
  });

  it("rejects a name over 80 characters", async () => {
    const res = await register({
      name: "a".repeat(81),
      email: uniqueEmail(),
      password: "password123",
    });
    assert.equal(res.status, 400);
    assert.match(res.body.errors.name, /80 characters/);
  });

  it("rejects values of the wrong type", async () => {
    const res = await register({ name: 123, email: ["a@b.co"], password: 12345678 });
    assert.equal(res.status, 400);
    assert.deepEqual(Object.keys(res.body.errors).sort(), ["email", "name", "password"]);
  });

  it("rejects an invalid email", async () => {
    for (const email of ["nope", "a@b", "a b@c.com", "@example.com"]) {
      const res = await register({ name: "A", email, password: "password123" });
      assert.equal(res.status, 400, email);
      assert.equal(res.body.errors.email, "Please enter a valid email address.");
    }
  });

  it("rejects a password shorter than 8 or longer than 200 characters", async () => {
    let res = await register({ name: "A", email: uniqueEmail(), password: "short" });
    assert.equal(res.status, 400);
    assert.match(res.body.errors.password, /at least 8/);

    res = await register({ name: "A", email: uniqueEmail(), password: "x".repeat(201) });
    assert.equal(res.status, 400);
    assert.match(res.body.errors.password, /200 characters/);
  });

  it("rejects malformed JSON", async () => {
    const res = await api.request("POST", "/auth/register", { raw: "{bad json" });
    assert.equal(res.status, 400);
    assert.equal(res.body.message, "Request body must be valid JSON.");
  });
});

describe("POST /api/auth/register - success", () => {
  it("trims the name, normalizes the email and never returns the password", async () => {
    const email = uniqueEmail("MixedCase");
    const res = await register({
      name: "  Hana  ",
      email: `  ${email.toUpperCase()} `,
      password: "password123",
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.user.name, "Hana");
    assert.equal(res.body.data.user.email, email.toLowerCase());
    assert.ok(res.body.data.token);
    assert.equal("passwordHash" in res.body.data.user, false);
  });

  it("ignores fields that have no validation rule", async () => {
    const res = await register({
      name: "Eve",
      email: uniqueEmail(),
      password: "password123",
      isAdmin: true,
      id: 1,
    });
    assert.equal(res.status, 201);
    assert.equal("isAdmin" in res.body.data.user, false);
  });

  it("rejects an email that is already registered, in any letter case", async () => {
    const email = uniqueEmail();
    await register({ name: "A", email, password: "password123" });
    const res = await register({ name: "B", email: email.toUpperCase(), password: "password123" });
    assert.equal(res.status, 409);
  });

  it("keeps spaces inside passwords exactly as typed", async () => {
    const email = uniqueEmail();
    await register({ name: "A", email, password: "  spaced pass  " });
    assert.equal((await login({ email, password: "  spaced pass  " })).status, 200);
    assert.equal((await login({ email, password: "spaced pass" })).status, 401);
  });
});

describe("POST /api/auth/login", () => {
  const email = uniqueEmail("login");

  before(async () => {
    await register({ name: "Login User", email, password: "password123" });
  });

  it("requires both fields", async () => {
    const res = await login({ email: "  ", password: "" });
    assert.equal(res.status, 400);
    assert.deepEqual(Object.keys(res.body.errors).sort(), ["email", "password"]);
  });

  it("logs in with any letter case and surrounding spaces in the email", async () => {
    const res = await login({ email: ` ${email.toUpperCase()} `, password: "password123" });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.email, email);
    assert.equal("passwordHash" in res.body.data.user, false);
  });

  it("uses the same message for a wrong password and an unknown email", async () => {
    const wrongPassword = await login({ email, password: "wrong-password" });
    const unknownEmail = await login({ email: uniqueEmail("ghost"), password: "password123" });
    assert.equal(wrongPassword.status, 401);
    assert.equal(unknownEmail.status, 401);
    assert.equal(wrongPassword.body.message, unknownEmail.body.message);
  });
});

describe("GET /api/auth/me and tokens", () => {
  let token;
  before(async () => {
    token = (await register({ name: "Me", email: uniqueEmail(), password: "password123" })).body
      .data.token;
  });

  it("returns the logged-in user", async () => {
    const res = await api.request("GET", "/auth/me", { token });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.name, "Me");
  });

  it("rejects missing, tampered and forged tokens", async () => {
    assert.equal((await api.request("GET", "/auth/me")).status, 401);
    assert.equal((await api.request("GET", "/auth/me", { token: `${token}x` })).status, 401);

    const [header, payload, signature] = token.split(".");
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
    claims.sub = String(Number(claims.sub) + 1000);
    const forged = `${header}.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.${signature}`;
    assert.equal((await api.request("GET", "/auth/me", { token: forged })).status, 401);
  });
});
