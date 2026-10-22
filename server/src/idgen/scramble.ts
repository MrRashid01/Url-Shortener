import { encodeBase62 } from "./base62";

const SPACE = 62n ** 7n; // every possible 7-character code
const MULTIPLIER = 2654435761n; // odd, and not divisible by 31, so it shares no factor with 62^7
const OFFSET = 1234567891n;

// A reversible shuffle: every counter gives exactly one result, so no collisions
export function scramble(counter: bigint): bigint {
  if (counter < 0n || counter >= SPACE) throw new Error("Counter out of range");
  return (counter * MULTIPLIER + OFFSET) % SPACE;
}

export function toShortCode(counter: bigint): string {
  return encodeBase62(scramble(counter)).padStart(7, "0");
}