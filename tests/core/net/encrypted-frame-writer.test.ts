import { describe, expect, it } from 'vitest';
import EncryptedFrameWriter from '../../../src/core/net/encrypted-frame-writer.js';
import ChachaCipher from '../../../src/core/crypto/chacha-cipher.js';

describe('EncryptedFrameWriter', () => {
  const dataKey = Buffer.alloc(32, 0xaa);
  const dataNonce = Buffer.alloc(12, 0xbb);
  const headerKey = Buffer.alloc(32, 0xcc);
  const headerNonce = Buffer.alloc(12, 0xdd);

  const packet = Buffer.from([0x40, 0x44, 0x51, 0x41, 0x40, 0x42, 0x68, 0x69, 0x48, 0x52, 0x4c]);

  it('matches the worked example with a fixed padding byte', () => {
    const writer = new EncryptedFrameWriter(
      new ChachaCipher(headerKey, headerNonce),
      new ChachaCipher(dataKey, dataNonce),
    );

    const frame = writer.encode(packet, Buffer.from([0x2a]));

    expect(frame.toString('latin1')).toBe('mQ3mRQweSIo8EgWc+9Qx4');
  });

  it('produces a different result on each call, since both ciphers advance their counter', () => {
    const writer = new EncryptedFrameWriter(
      new ChachaCipher(headerKey, headerNonce),
      new ChachaCipher(dataKey, dataNonce),
    );

    const first = writer.encode(packet, Buffer.from([0x2a]));
    const second = writer.encode(packet, Buffer.from([0x2a]));

    expect(first.equals(second)).toBe(false);
  });
});
