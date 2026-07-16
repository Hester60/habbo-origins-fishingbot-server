import { describe, expect, it } from 'vitest';
import EncryptedFrameReader from '../../../src/core/net/encrypted-frame-reader.js';
import ChachaCipher from '../../../src/core/crypto/chacha-cipher.js';

describe('EncryptedFrameReader', () => {
  const dataKey = Buffer.alloc(32, 0xaa);
  const dataNonce = Buffer.alloc(12, 0xbb);
  const headerKey = Buffer.alloc(32, 0xcc);
  const headerNonce = Buffer.alloc(12, 0xdd);

  function makeReader(): EncryptedFrameReader {
    return new EncryptedFrameReader(
      new ChachaCipher(headerKey, headerNonce),
      new ChachaCipher(dataKey, dataNonce),
    );
  }

  it('decodes a single message received in one push', () => {
    const reader = makeReader();

    reader.push(Buffer.from('mQ3mWgweSIo8EgWc+9Qx51', 'latin1'));

    expect(reader.read()).toEqual([
      Buffer.from([0x40, 0x44, 0x51, 0x41, 0x40, 0x42, 0x68, 0x69, 0x48, 0x52, 0x4c]),
    ]);
  });

  it('waits for the full frame across fragmented pushes', () => {
    const reader = makeReader();
    const frame = Buffer.from('mQ3mWgweSIo8EgWc+9Qx51', 'latin1');

    reader.push(frame.subarray(0, 3));
    expect(reader.read()).toEqual([]);

    reader.push(frame.subarray(3, 10));
    expect(reader.read()).toEqual([]);

    reader.push(frame.subarray(10));
    expect(reader.read()).toEqual([
      Buffer.from([0x40, 0x44, 0x51, 0x41, 0x40, 0x42, 0x68, 0x69, 0x48, 0x52, 0x4c]),
    ]);
  });

  it('extracts several messages bundled in a single encrypted chunk', () => {
    const reader = makeReader();

    reader.push(Buffer.from('mQ3mQgweTYosRj', 'latin1'));

    expect(reader.read()).toEqual([Buffer.from([0x40, 0x44]), Buffer.from([0x40, 0x45])]);
  });
});
