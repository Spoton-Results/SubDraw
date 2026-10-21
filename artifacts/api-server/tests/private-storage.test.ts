import test from "node:test";
import assert from "node:assert/strict";
import { ownerNamespace, isOwnedPrivateKey, privateDomainsDisabled, safeDownloadName } from "../src/lib/privateStoragePolicy.ts";
const key = `private/${ownerNamespace("user1")}/11111111-1111-4111-8111-111111111111`;
test("a private key belongs only to its uploader", () => {
  assert.equal(isOwnedPrivateKey(key, "user1"), true);
  assert.equal(isOwnedPrivateKey(key, "user2"), false);
});
test("legacy and malformed paths are not private owner grants", () => {
  for (const path of ["uploads/file.pdf", `${key}/other`, `private/${ownerNamespace("user1")}/../other`, "", "private/other/id"]) assert.equal(isOwnedPrivateKey(path, "user1"), false);
});
test("empty and oversized owner IDs are rejected", () => {
  assert.throws(() => ownerNamespace(""));
  assert.throws(() => ownerNamespace("x".repeat(385)));
});
test("both public access mechanisms must be explicitly disabled", () => {
  assert.equal(privateDomainsDisabled({ enabled: false }, { domains: [] }), true);
  assert.equal(privateDomainsDisabled({ enabled: false }, { domains: [{ enabled: false }] }), true);
  for (const pair of [[{ enabled: true }, { domains: [] }], [{ enabled: false }, { domains: [{ enabled: true }] }], [{}, { domains: [] }], [{ enabled: false }, {}], [null, null]]) assert.equal(privateDomainsDisabled(pair[0], pair[1]), false);
});
test("download names cannot inject response headers", () => {
  assert.equal(safeDownloadName("a\r\n\";x.pdf").includes("\r"), false);
  assert.equal(safeDownloadName("a\r\n\";x.pdf").includes("\""), false);
  assert.equal(safeDownloadName(""), "download");
});
