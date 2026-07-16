import { describe, expect, it } from 'vitest';
import Base64Codec from '../../../src/core/wire/base64-codec.js';

describe('Base64Codec', () => {
  it('encodeInt() produces a fixed-width, 0x40-offset value', () => {
    expect(Base64Codec.encodeInt(0, 2)).toEqual(Buffer.from([0x40, 0x40]));
    expect(Base64Codec.encodeInt(4, 2)).toEqual(Buffer.from([0x40, 0x44]));
    expect(Base64Codec.encodeInt(300, 3)).toEqual(Buffer.from([0x40, 0x44, 0x6c]));
  });

  it('decodeInt() is the inverse of encodeInt()', () => {
    expect(Base64Codec.decodeInt(Buffer.from([0x53, 0x75]))).toEqual(1269);
  });

  it('encodeBytes() produces standard base64 with padding stripped', () => {
    expect(Base64Codec.encodeBytes(Buffer.from([0xff, 0x00, 0x10]))).toEqual(
      Buffer.from('/wAQ', 'latin1'),
    );
  });

  it('decodeBytes() is the inverse of encodeBytes()', () => {
    expect(Base64Codec.decodeBytes(Buffer.from('/wAQ', 'latin1'))).toEqual(
      Buffer.from([0xff, 0x00, 0x10]),
    );
  });
});
