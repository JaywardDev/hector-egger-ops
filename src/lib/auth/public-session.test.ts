import assert from "node:assert/strict";
import test from "node:test";

import { hasClearlyValidAccessToken } from "@/src/lib/auth/public-session";

const createJwtLikeToken = (payload: Record<string, unknown>) => {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" }), "utf8").toString("base64url");
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");

  return `${header}.${body}.signature`;
};

test("hasClearlyValidAccessToken returns false for missing or malformed tokens", () => {
  assert.equal(hasClearlyValidAccessToken(null), false);
  assert.equal(hasClearlyValidAccessToken(""), false);
  assert.equal(hasClearlyValidAccessToken("not-a-jwt"), false);
});

test("hasClearlyValidAccessToken returns false for expired or exp-less tokens", () => {
  const expired = createJwtLikeToken({ exp: Math.floor(Date.now() / 1000) - 60 });
  const noExp = createJwtLikeToken({ sub: "user-1" });

  assert.equal(hasClearlyValidAccessToken(expired), false);
  assert.equal(hasClearlyValidAccessToken(noExp), false);
});

test("hasClearlyValidAccessToken returns true for future-exp tokens", () => {
  const valid = createJwtLikeToken({ exp: Math.floor(Date.now() / 1000) + 60 * 10 });

  assert.equal(hasClearlyValidAccessToken(valid), true);
});
