import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeBase62, decodeBase62 } from "./base62";
import { toShortCode } from "./scramble";
import { Snowflake, parseSnowflake } from "./snowflake";

test("base62 gives the values we expect", () => {
  assert.equal(encodeBase62(0), "0");
  assert.equal(encodeBase62(61), "z");
  assert.equal(encodeBase62(62), "10");
  assert.equal(encodeBase62(125), "21"); // 2 * 62 + 1
});

test("base62 encode then decode returns the same number", () => {
  for (const n of [0n, 1n, 61n, 62n, 125n, 123456789n, 62n ** 7n - 1n]) {
    assert.equal(decodeBase62(encodeBase62(n)), n);
  }
});

test("100,000 scrambled counters are all unique and 7 characters long", () => {
  const seen = new Set<string>();
  for (let i = 0n; i < 100_000n; i++) {
    const code = toShortCode(i);
    assert.equal(code.length, 7);
    assert.ok(!seen.has(code), `duplicate code ${code}`);
    seen.add(code);
  }
});

test("snowflake ids are unique and always increase", () => {
  const generator = new Snowflake(1);
  let previous = -1n;
  const seen = new Set<bigint>();
  for (let i = 0; i < 20_000; i++) {
    const id = generator.next();
    assert.ok(id > previous);
    assert.ok(!seen.has(id));
    seen.add(id);
    previous = id;
  }
});

test("two machines never produce the same id", () => {
  const a = new Snowflake(1);
  const b = new Snowflake(2);
  const ids = new Set<bigint>();
  for (let i = 0; i < 5_000; i++) {
    ids.add(a.next());
    ids.add(b.next());
  }
  assert.equal(ids.size, 10_000);
});

test("a snowflake id can be taken apart again", () => {
  const parsed = parseSnowflake(new Snowflake(7).next());
  assert.equal(parsed.machineId, 7);
  assert.ok(Math.abs(parsed.time.getTime() - Date.now()) < 5_000);
});