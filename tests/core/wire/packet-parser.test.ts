import { describe, expect, it } from 'vitest';
import PacketParser from '../../../src/core/wire/packet-parser.js';

describe('PacketParser', () => {
  it('splits header and body from a frame', () => {
    const frame = Buffer.from([0x40, 0x47, 0x52, 0x4a, 0x6f, 0x6b, 0x02, 0x99]);

    const { header, body } = PacketParser.parse(frame);

    expect(header).toBe(7);
    expect(body).toEqual(Buffer.from([0x52, 0x4a, 0x6f, 0x6b, 0x02, 0x99]));
  });

  it('handles a header-only frame (empty body)', () => {
    const frame = Buffer.from([0x40, 0x44]);

    const { header, body } = PacketParser.parse(frame);

    expect(header).toBe(4);
    expect(body).toEqual(Buffer.alloc(0));
  });

  it('returns a header of -1 for a frame shorter than 2 bytes, without throwing', () => {
    expect(PacketParser.parse(Buffer.from([0x40]))).toEqual({
      header: -1,
      body: Buffer.from([0x40]),
    });
    expect(PacketParser.parse(Buffer.alloc(0))).toEqual({ header: -1, body: Buffer.alloc(0) });
  });
});
