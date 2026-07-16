/**
 * Variable-length integer encoding for values inside a packet body (game
 * data, coordinates, quantities...) — unlike Base64Codec.encodeInt, which
 * needs a fixed width decided by the caller, VL64 is self-describing: the
 * value's own first byte carries how many bytes follow, so a value that
 * happens to be small only costs 1 byte instead of always paying for a
 * fixed width.
 *
 * Byte layout is little-endian-like across bytes (opposite of encodeInt,
 * which is most-significant-byte-first): the head byte holds the lowest 2
 * bits of the value, and each following byte holds the next 6 bits, going
 * from least to most significant as you move forward in the buffer.
 */
export default class Vl64Codec {
  static encode(value: number): Buffer {
    const sign: number = value < 0 ? 1 : 0;
    const abs = Math.abs(value);

    const low2: number = abs & 0b11;

    let remaining: number = abs >> 2;

    const bytes: number[] = [];

    while (remaining > 0) {
      bytes.push((remaining & 0x3f) | 0x40);
      remaining >>= 6;
    }

    const headByte: number = (0b01 << 6) | ((bytes.length + 1) << 3) | (sign << 2) | low2;

    return Buffer.from([headByte, ...bytes]);
  }

  static decode(bytes: Buffer, pos?: number): [number, number] {
    const start: number = pos ? pos : 0;

    const headByte: number = bytes[start];
    const sign: number = (headByte >> 2) & 0b1;
    const low2: number = headByte & 0b11;

    let length: number = (headByte >> 3) & 0b111;

    if (length > bytes.length - start) {
      length = Math.max(0, bytes.length - start);
    }

    let result: number = 0;
    let shift: number = 2;

    for (let i = 1; i < length; i++) {
      let bits: number = bytes[start + i] & 0x3f;
      bits = bits << shift;
      shift += 6;

      result |= bits;
    }

    result = result | low2;

    return [sign === 0 ? result : -result, length];
  }
}
