import { describe, expect, it } from 'vitest';
import PlaintextFrameWriter from '../../../src/core/net/plaintext-frame-writer.js';

describe('PlaintextFrameWriter', () => {
  it('prefixes the packet with its length on 3 bytes, packet bytes unchanged', () => {
    const packet = Buffer.from([0x40, 0x44]);

    expect(PlaintextFrameWriter.encode(packet)).toEqual(
      Buffer.from([0x40, 0x40, 0x42, 0x40, 0x44]),
    );
  });
});
