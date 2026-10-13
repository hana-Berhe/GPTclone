import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readSchemaStatements } from "../db/setup.js";
import { toGeminiHistory } from "../src/lib/gemini-history.js";
import { hashPassword, verifyPassword } from "../src/lib/password.js";
import { createToken, verifyToken } from "../src/lib/token.js";

describe("toGeminiHistory", () => {
  it("drops leading model turns and merges consecutive turns of the same role", () => {
    const result = toGeminiHistory([
      { role: "assistant", content: "a0" },
      { role: "user", content: "u1" },
      { role: "user", content: "u2" },
      { role: "assistant", content: "a1" },
      { role: "user", content: "q" },
    ]);
    assert.deepEqual(
      result.map((c) => [c.role, c.parts[0].text]),
      [
        ["user", "u1\n\nu2"],
        ["model", "a1"],
        ["user", "q"],
      ],
    );
  });
});

describe("password hashing", () => {
  it("verifies the right password and rejects others", async () => {
    const hash = await hashPassword("correct horse");
    assert.notEqual(hash, "correct horse");
    assert.equal(await verifyPassword("correct horse", hash), true);
    assert.equal(await verifyPassword("wrong", hash), false);
    assert.equal(await verifyPassword("anything", "not-a-hash"), false);
  });

  it("uses a different salt every time", async () => {
    assert.notEqual(await hashPassword("same"), await hashPassword("same"));
  });
});

describe("tokens", () => {
  it("round-trips a user id", () => {
    assert.equal(verifyToken(createToken(42)), 42);
  });

  it("rejects garbage", () => {
    for (const value of [undefined, "", "a.b.c", "x".repeat(50), 123]) {
      assert.equal(verifyToken(value), null);
    }
  });
});

describe("schema.sql", () => {
  it("splits into the three CREATE TABLE statements", () => {
    const statements = readSchemaStatements();
    assert.equal(statements.length, 3);
    statements.forEach((s) => assert.match(s, /^CREATE TABLE IF NOT EXISTS/));
  });
});
