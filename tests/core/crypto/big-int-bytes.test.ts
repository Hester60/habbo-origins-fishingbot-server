import { describe, expect, it } from 'vitest';
import BigIntBytes from '../../../src/core/crypto/big-int-bytes.js';

describe('big-int-bytes', () => {
  it('Convert bigint to minimal bytes', () => {
    expect(BigIntBytes.toMinimalBytes(0n)).toEqual(Buffer.alloc(0));
    expect(BigIntBytes.toMinimalBytes(255n)).toEqual(Buffer.from([0xff]));
    expect(BigIntBytes.toMinimalBytes(256n)).toEqual(Buffer.from([0x01, 0x00]));
    expect(BigIntBytes.toMinimalBytes(65535n)).toEqual(Buffer.from([0xff, 0xff]));
  });

  it('Convert bytes to bigint', () => {
    expect(BigIntBytes.fromBytes(Buffer.from([0]))).toEqual(0n);
    expect(BigIntBytes.fromBytes(Buffer.from([0xff]))).toEqual(255n);
    expect(BigIntBytes.fromBytes(Buffer.from([0x01, 0x00]))).toEqual(256n);
    expect(BigIntBytes.fromBytes(Buffer.from([0xff, 0xff]))).toEqual(65535n);
    expect(BigIntBytes.fromBytes(Buffer.alloc(0))).toEqual(0n);
  });
});
