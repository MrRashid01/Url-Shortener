import { createHash, randomInt } from "node:crypto";
import { encodeBase62 } from "./base62";
import { toShortCode } from "./scramble";
import { Snowflake, parseSnowflake } from "./snowflake";

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function randomCode(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

// Hash the input, then keep only `length` Base62 characters (truncation)
function hashCode(input: string, length: number): string {
  const number = createHash("sha256").update(input).digest().readBigUInt64BE(0);
  return encodeBase62(number % 62n ** BigInt(length)).padStart(length, "0");
}

function countCollisions(make: (i: number) => string, total: number): number {
  const seen = new Set<string>();
  let collisions = 0;
  for (let i = 0; i < total; i++) {
    const code = make(i);
    if (seen.has(code)) collisions++;
    else seen.add(code);
  }
  return collisions;
}

console.log("\n1) Base62 lengths");
for (const n of [1n, 125n, 1_000_000n, 62n ** 7n - 1n]) {
  console.log(`   ${n.toString().padStart(15)}  ->  ${encodeBase62(n)}`);
}

console.log("\n2) A plain counter is easy to guess. A scrambled one is not");
for (let i = 1n; i <= 5n; i++) {
  console.log(`   counter ${i}: plain "${encodeBase62(i)}"   scrambled "${toShortCode(i)}"`);
}

console.log("\n3) Snowflake ids");
const generator = new Snowflake(3);
for (let i = 0; i < 3; i++) {
  const id = generator.next();
  console.log(`   ${id}  base62 "${encodeBase62(id)}" (${encodeBase62(id).length} chars)`, parseSnowflake(id));
}

const TOTAL = 1_000_000;
console.log(`\n4) Collisions after ${TOTAL.toLocaleString()} links`);
for (const length of [4, 7]) {
  const random = countCollisions(() => randomCode(length), TOTAL);
  const hashed = countCollisions((i) => hashCode(`https://example.com/page/${i}`, length), TOTAL);
  console.log(`   ${length}-char codes: random ${random.toLocaleString()}   truncated SHA-256 ${hashed.toLocaleString()}`);
}
console.log("");