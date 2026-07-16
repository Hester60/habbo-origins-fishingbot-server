import { describe, expect, it } from 'vitest';
import PacketWriter from '../../../src/core/wire/packet-writer.js';

describe('PacketWriter', () => {
  it('builds a header-only packet', () => {
    expect(new PacketWriter(4).build()).toEqual(Buffer.from([0x40, 0x44]));
  });

  it('builds a packet with an int, a string, and a raw token', () => {
    const packet = new PacketWriter(4).int(5).str('hi').raw('HRL').build();

    const header = Buffer.from([0x40, 0x44]);
    const encodedInt = Buffer.from([0x51, 0x41]);
    const encodedStr = Buffer.from([0x40, 0x42, 0x68, 0x69]);
    const rawToken = Buffer.from([0x48, 0x52, 0x4c]);

    expect(packet).toEqual(Buffer.concat([header, encodedInt, encodedStr, rawToken]));
  });

  it('is fluent: each method returns the same instance', () => {
    const writer = new PacketWriter(4);
    expect(writer.int(1)).toBe(writer);
    expect(writer.str('x')).toBe(writer);
    expect(writer.raw('y')).toBe(writer);
  });
});
