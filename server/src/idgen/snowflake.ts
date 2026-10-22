// | 41 bits: time (ms) | 10 bits: machine | 12 bits: sequence |
const EPOCH = 1_735_689_600_000n; // 2025-01-01T00:00:00Z
const MACHINE_BITS = 10n;
const SEQUENCE_BITS = 12n;
const MAX_MACHINE = (1n << MACHINE_BITS) - 1n; // 1023
const MAX_SEQUENCE = (1n << SEQUENCE_BITS) - 1n; // 4095

export class Snowflake {
  private lastTimestamp = -1n;
  private sequence = 0n;

  constructor(
    private readonly machineId: number,
    private readonly now: () => number = Date.now
  ) {
    if (!Number.isInteger(machineId) || machineId < 0 || BigInt(machineId) > MAX_MACHINE) {
      throw new Error(`machineId must be a whole number from 0 to ${MAX_MACHINE}`);
    }
  }

  next(): bigint {
    let timestamp = BigInt(this.now());

    if (timestamp < this.lastTimestamp) {
      // The clock moved backwards. Continuing could repeat an ID, so we stop.
      throw new Error("Clock moved backwards. Refusing to generate IDs.");
    }

    if (timestamp === this.lastTimestamp) {
      this.sequence = (this.sequence + 1n) & MAX_SEQUENCE;
      if (this.sequence === 0n) {
        // We used all 4096 IDs of this millisecond: wait for the next one
        while (timestamp <= this.lastTimestamp) timestamp = BigInt(this.now());
      }
    } else {
      this.sequence = 0n;
    }

    this.lastTimestamp = timestamp;

    return (
      ((timestamp - EPOCH) << (MACHINE_BITS + SEQUENCE_BITS)) |
      (BigInt(this.machineId) << SEQUENCE_BITS) |
      this.sequence
    );
  }
}

// Take an ID apart again (great for learning and debugging)
export function parseSnowflake(id: bigint) {
  return {
    time: new Date(Number((id >> (MACHINE_BITS + SEQUENCE_BITS)) + EPOCH)),
    machineId: Number((id >> SEQUENCE_BITS) & MAX_MACHINE),
    sequence: Number(id & MAX_SEQUENCE),
  };
}