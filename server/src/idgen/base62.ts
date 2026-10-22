const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BASE = BigInt(ALPHABET.length); // 62

export function encodeBase62(value: bigint | number): string {
  let n = typeof value === "bigint" ? value : BigInt(value);
  if (n < 0n) throw new Error("Cannot encode a negative number");
  if (n === 0n) return ALPHABET[0];

  let out = "";
  while (n > 0n) {
    out = ALPHABET[Number(n % BASE)] + out; // last digit first
    n /= BASE;
  }
  return out;
}

export function decodeBase62(text: string): bigint {
  let n = 0n;
  for (const ch of text) {
    const digit = ALPHABET.indexOf(ch);
    if (digit === -1) throw new Error(`Invalid Base62 character: ${ch}`);
    n = n * BASE + BigInt(digit);
  }
  return n;
}