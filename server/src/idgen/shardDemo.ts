import { createHash } from "node:crypto";
import { generateCode } from "../utils/generateCode";

const hash32 = (text: string) => createHash("sha1").update(text).digest().readUInt32BE(0);

// Consistent hashing: shards sit on a circle, a key goes to the next shard clockwise
class HashRing {
  private ring: { point: number; node: string }[] = [];

  constructor(nodes: string[], private readonly virtualNodes = 100) {
    for (const node of nodes) this.add(node);
  }

  add(node: string) {
    // Many "virtual" points per shard keep the spread even
    for (let v = 0; v < this.virtualNodes; v++) {
      this.ring.push({ point: hash32(`${node}#${v}`), node });
    }
    this.ring.sort((a, b) => a.point - b.point);
  }

  get(key: string): string {
    const h = hash32(key);
    let lo = 0;
    let hi = this.ring.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.ring[mid].point < h) lo = mid + 1;
      else hi = mid;
    }
    return this.ring[lo % this.ring.length].node; // wrap around the circle
  }
}

const codes = Array.from({ length: 100_000 }, () => generateCode());
const pct = (n: number) => `${((n / codes.length) * 100).toFixed(1)}%`;

// 1) How evenly do 100,000 links spread over 4 shards?
const counts = [0, 0, 0, 0];
for (const code of codes) counts[hash32(code) % 4]++;
console.log("\nModulo, 4 shards, links per shard:", counts);

// 2) Add a 5th shard. How many links must move?
let movedModulo = 0;
for (const code of codes) {
  if (hash32(code) % 4 !== hash32(code) % 5) movedModulo++;
}

const ring4 = new HashRing(["s0", "s1", "s2", "s3"]);
const ring5 = new HashRing(["s0", "s1", "s2", "s3", "s4"]);
let movedRing = 0;
for (const code of codes) {
  if (ring4.get(code) !== ring5.get(code)) movedRing++;
}

console.log(`\nAdd a 5th shard:`);
console.log(`  modulo (hash % N)   moves ${pct(movedModulo)} of all links`);
console.log(`  consistent hashing  moves ${pct(movedRing)} of all links`);
console.log("");