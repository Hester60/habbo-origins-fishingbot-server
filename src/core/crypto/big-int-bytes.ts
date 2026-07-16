/**
 * Bridges the bigint world (Diffie-Hellman arithmetic) and the byte world
 * (network transport, HKDF input) — converts a bigint to/from its minimal
 * big-endian byte representation, with no leading zero padding.
 */
export default class BigIntBytes {
  static toMinimalBytes(value: bigint): Buffer {
    // Empty buffer
    if (value === 0n) return Buffer.alloc(0);

    const bytes: number[] = [];

    while (value > 0n) {
      bytes.push(Number(value & 0xffn));
      value >>= 8n;
    }

    bytes.reverse(); // Big Endian

    return Buffer.from(bytes);
  }

  static fromBytes(bytes: Buffer): bigint {
    if (bytes.length === 0) return 0n;

    return BigInt('0x' + bytes.toString('hex'));
  }
}
