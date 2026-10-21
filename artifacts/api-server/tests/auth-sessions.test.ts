import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { publicAuthUser, isMagicLinkUsable } from "../src/lib/authRecoveryPolicy.ts";
process.env.JWT_SECRET = "unit-test-only-key-not-for-production-123456789";
process.env.ADMIN_EMAIL = "admin@example.invalid";
const sessions = await import("../src/lib/sessionTokens.ts");
const auth = await import("../src/lib/auth.ts");
const user = { id: "user1", email: "gc@example.invalid", role: "GC", companyName: "Test GC" };
test("user token has a seven-day expiration and millisecond issue time", () => {
  const token = sessions.generateToken(user);
  const decoded = jwt.decode(token);
  if (!decoded || typeof decoded === "string") throw new Error("Expected token payload");
  assert.equal((decoded.exp ?? 0) - (decoded.iat ?? 0), sessions.USER_SESSION_SECONDS);
  const verified = sessions.verifyToken(token);
  assert.equal(verified?.id, user.id);
  assert.equal(Math.floor((verified?.issuedAtMs ?? 0) / 1000), verified?.iat);
});
test("legacy long-lived tokens are rejected", () => {
  assert.equal(sessions.verifyToken(jwt.sign(user, process.env.JWT_SECRET!, { expiresIn: "100y" })), null);
});
test("user and administrator tokens are not interchangeable", () => {
  const normal = sessions.generateToken(user);
  const admin = sessions.generateAdminToken(process.env.ADMIN_EMAIL!);
  assert.equal(sessions.verifyToken(admin), null);
  assert.equal(sessions.verifyAdminToken(normal), null);
  assert.equal(sessions.verifyAdminToken(admin)?.isAdmin, true);
});
test("wrong signing algorithm is rejected", () => {
  const token = jwt.sign(user, process.env.JWT_SECRET!, { algorithm: "HS384", expiresIn: "1h" });
  assert.equal(sessions.verifyToken(token), null);
});
test("missing or weak signing configuration fails closed", () => {
  const saved = process.env.JWT_SECRET;
  try {
    delete process.env.JWT_SECRET; assert.throws(() => sessions.assertAuthConfiguration());
    process.env.JWT_SECRET = "short"; assert.throws(() => sessions.assertAuthConfiguration());
  } finally { process.env.JWT_SECRET = saved; }
});
test("unknown roles and parented owner claims do not gain owner privileges", () => {
  for (const candidate of [{ ...user, gcTeamRole: "unknown" }, { ...user, gcParentId: "owner1", gcTeamRole: "owner" }, { ...user, gcParentId: "owner1", gcTeamRole: null }]) {
    assert.equal(auth.getGCTeamRole(candidate), null);
    assert.equal(auth.isGCOwner(candidate), false);
    assert.equal(auth.canApproveInvoices(candidate), false);
    assert.equal(auth.canDownloadFiles(candidate), false);
  }
});
test("legacy root GC owner remains supported", () => assert.equal(auth.isGCOwner(user), true));
const now = new Date("2026-10-21T12:00:00Z");
const record = { usedAt: null, createdAt: new Date(now.getTime() - 60000), expiresAt: new Date(now.getTime() + 60000) };
const account = { pausedAt: null, passwordChangedAt: null };
test("unused unexpired magic link is eligible", () => assert.equal(isMagicLinkUsable(record, account, now), true));
test("used magic link is rejected", () => assert.equal(isMagicLinkUsable({ ...record, usedAt: now }, account, now), false));
test("expired or invalid expiry is rejected", () => {
  for (const expiresAt of [now, new Date(now.getTime() - 1), new Date("invalid")]) assert.equal(isMagicLinkUsable({ ...record, expiresAt }, account, now), false);
});
test("paused account cannot use a magic link", () => assert.equal(isMagicLinkUsable(record, { ...account, pausedAt: now }, now), false));
test("password change invalidates older magic links", () => assert.equal(isMagicLinkUsable(record, { ...account, passwordChangedAt: now }, now), false));
test("auth response omits password reset secrets and internal notes", () => {
  const safe = publicAuthUser({ ...user, passwordHash: "hash", passwordResetToken: "reset-token", passwordResetExpires: now, adminNotes: "internal" });
  for (const key of ["passwordHash", "passwordResetToken", "passwordResetExpires", "adminNotes"]) assert.equal(key in safe, false);
  assert.equal(safe.email, user.email);
  assert.equal(safe.id, user.id);
});
