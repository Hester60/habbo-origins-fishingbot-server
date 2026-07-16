import { describe, expect, it } from 'vitest';
import Vl64Codec from '../../../src/core/wire/vl64-codec.js';

describe('Vl64Codec', () => {
  it('encode() produces the expected bytes for positive and negative values', () => {
    expect(Vl64Codec.encode(0)).toEqual(Buffer.from([0x48]));
    expect(Vl64Codec.encode(3)).toEqual(Buffer.from([0x4b]));
    expect(Vl64Codec.encode(100)).toEqual(Buffer.from([0x50, 0x59]));
    expect(Vl64Codec.encode(-100)).toEqual(Buffer.from([0x54, 0x59]));
  });

  it('decode() round-trips values produced by encode()', () => {
    for (const v of [0, 3, 100, -100, 999, -999, 50000]) {
      const encoded = Vl64Codec.encode(v);
      const [value, consumed] = Vl64Codec.decode(encoded);
      expect(value).toBe(v);
      expect(consumed).toBe(encoded.length);
    }
  });

  it('decode() never throws on a truncated buffer', () => {
    const truncated = Vl64Codec.encode(100).subarray(0, 1);
    expect(() => Vl64Codec.decode(truncated)).not.toThrow();
  });

  it('decode() returns [0, 0] when pos is past the end of the buffer', () => {
    expect(Vl64Codec.decode(Buffer.from([0x50, 0x59]), 5)).toEqual([0, 0]);
  });

  it('decode() reads values back to back at different positions in the same buffer', () => {
    const twoValues = Buffer.concat([Vl64Codec.encode(3), Vl64Codec.encode(100)]);

    expect(Vl64Codec.decode(twoValues, 0)).toEqual([3, 1]);
    expect(Vl64Codec.decode(twoValues, 1)).toEqual([100, 2]);
  });

  it('decode() does not consume a trailing byte belonging to the next field', () => {
    const withExtra = Buffer.concat([Vl64Codec.encode(100), Buffer.from([0x99])]);

    expect(Vl64Codec.decode(withExtra, 0)).toEqual([100, 2]);
  });
});
